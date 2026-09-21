import { useMemo, useState } from 'react'

import { cssVar, semantic } from '@/shared/design/tokens'

import type {
  ReportSpreadsheetCellDto,
  ReportSpreadsheetCellStyleDto,
  ReportSpreadsheetDto,
  ReportSpreadsheetSheetDto,
} from '@/pages/reports/report-list/types/report'

/**
 * Табличный документ утверждённого бланка.
 *
 * <p>Бланки регламентированной отчётности утверждены приказом: размеры клеток, шрифты, заливки
 * и рамки менять нельзя. Бэк отдаёт готовую сетку, снятую с макета 1С, поэтому здесь нет ни
 * одного собственного решения об оформлении — только перенос стиля ячейки в CSS.
 */
interface SpreadsheetViewProps {
  spreadsheet: ReportSpreadsheetDto
}

const GRAN: Record<string, string> = {
  thin: '1px solid',
  medium: '2px solid',
  thick: '3px solid',
  double: '3px double',
  dashed: '1px dashed',
  dotted: '1px dotted',
}

// Дефолт границы без цвета от бэка — токен текста, не literal (страж no-hex-drift)
const granitsa = (value?: string, color?: string): string | undefined =>
  value
    ? `${GRAN[value] ?? GRAN.thin} ${color ?? cssVar(semantic.textPrimary)}`
    : undefined

const stilYacheyki = (
  style: ReportSpreadsheetCellStyleDto | undefined
): React.CSSProperties => {
  if (!style) return {}
  return {
    fontFamily: style.fontName,
    fontSize: style.fontSize ? `${String(style.fontSize)}pt` : undefined,
    fontWeight: style.bold ? 700 : undefined,
    fontStyle: style.italic ? 'italic' : undefined,
    textDecoration: style.underline ? 'underline' : undefined,
    color: style.color,
    backgroundColor: style.background,
    textAlign: (style.align as React.CSSProperties['textAlign']) ?? undefined,
    verticalAlign: style.verticalAlign ?? undefined,
    whiteSpace: style.wrap ? 'pre-wrap' : 'nowrap',
    borderTop: granitsa(style.borderTop, style.borderColor),
    borderRight: granitsa(style.borderRight, style.borderColor),
    borderBottom: granitsa(style.borderBottom, style.borderColor),
    borderLeft: granitsa(style.borderLeft, style.borderColor),
    writingMode:
      style.rotation === 90 || style.rotation === -90
        ? 'vertical-rl'
        : undefined,
  }
}

/** Пустая клетка сетки — ячейка, которой нет в ответе бэка. */
interface PustayaKletka {
  column: number
}

type Kletka = ReportSpreadsheetCellDto | PustayaKletka

const zapolnennaya = (kletka: Kletka): kletka is ReportSpreadsheetCellDto =>
  'row' in kletka

/**
 * Раскладывает ячейки по сетке, добавляя пустые клетки на месте пропусков.
 *
 * <p>Бэк отдаёт только непустые ячейки, а в HTML-таблице пропуск сдвинул бы все следующие
 * колонки строки: сетка бланка поехала бы. Здесь считается занятость клеток с учётом
 * объединений (в том числе приходящих сверху по `rowSpan`).
 */
const klyuch = (row: number, column: number): string =>
  `${String(row)}:${String(column)}`

const razmetka = (sheet: ReportSpreadsheetSheetDto): Kletka[][] => {
  const shirina = sheet.columnWidths.length
  const vsego = sheet.rowHeights.length
  const poKoordinate = new Map<string, ReportSpreadsheetCellDto>()
  for (const cell of sheet.cells) {
    poKoordinate.set(klyuch(cell.row, cell.column), cell)
  }
  const zanyato = new Set<string>()
  const setka: Kletka[][] = []
  for (let r = 0; r < vsego; r++) {
    const stroka: Kletka[] = []
    for (let c = 0; c < shirina; c++) {
      if (zanyato.has(klyuch(r, c))) continue
      const cell = poKoordinate.get(klyuch(r, c))
      if (!cell) {
        stroka.push({ column: c })
        continue
      }
      const rowSpan = cell.rowSpan ?? 1
      const colSpan = cell.colSpan ?? 1
      for (let dr = 0; dr < rowSpan; dr++) {
        for (let dc = 0; dc < colSpan; dc++) {
          zanyato.add(klyuch(r + dr, c + dc))
        }
      }
      stroka.push(cell)
      c += colSpan - 1
    }
    setka.push(stroka)
  }
  return setka
}

const SheetView = ({ sheet }: { sheet: ReportSpreadsheetSheetDto }) => {
  const stroki = useMemo(() => razmetka(sheet), [sheet])
  return (
    <div className="overflow-x-auto">
      <table
        className="border-collapse bg-white"
        style={{ tableLayout: 'fixed', width: 'max-content' }}
      >
        <colgroup>
          {sheet.columnWidths.map((width, i) => (
            <col key={i} style={{ width: `${String(width)}px` }} />
          ))}
        </colgroup>
        <tbody>
          {stroki.map((yacheyki, r) => (
            <tr key={r} style={{ height: `${String(sheet.rowHeights[r])}px` }}>
              {yacheyki.map((kletka) =>
                zapolnennaya(kletka) ? (
                  <td
                    key={klyuch(kletka.row, kletka.column)}
                    rowSpan={kletka.rowSpan ?? 1}
                    colSpan={kletka.colSpan ?? 1}
                    style={{ padding: '0 2px', ...stilYacheyki(kletka.style) }}
                  >
                    {kletka.text ?? ''}
                  </td>
                ) : (
                  <td key={`empty:${klyuch(r, kletka.column)}`} />
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const SpreadsheetView = ({ spreadsheet }: SpreadsheetViewProps) => {
  const sheets = spreadsheet.sheets
  const [aktivnyy, setAktivnyy] = useState(0)
  if (sheets.length === 0) return null
  const sheet = sheets[Math.min(aktivnyy, sheets.length - 1)]
  return (
    <div className="flex flex-col gap-2">
      {sheets.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {sheets.map((s, i) => (
            <button
              key={s.code}
              type="button"
              onClick={() => {
                setAktivnyy(i)
              }}
              className={`rounded border px-3 py-1 text-sm ${
                i === aktivnyy
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-pending-gray-6 bg-white'
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}
      <SheetView sheet={sheet} />
    </div>
  )
}
