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
  /** Значения клеток, вписанные пользователем: имя области макета → текст. */
  blankValues?: Record<string, string>
  /**
   * Изменение клетки бланка. В 1С бланк редактируемый: отметку «X» в виде декларации,
   * номер уведомления и разрезы, которых нет в учёте, вписывает бухгалтер, и автозаполнение
   * их не перетирает. Отсутствие обработчика ⇒ бланк только для чтения.
   */
  onBlankValueChange?: (field: string, value: string) => void
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

interface SheetViewProps {
  sheet: ReportSpreadsheetSheetDto
  blankValues?: Record<string, string>
  onBlankValueChange?: (field: string, value: string) => void
  vybrannayaOblast?: string | null
  onVyborOblasti?: (oblast: string | null) => void
}

const SheetView = ({
  sheet,
  blankValues,
  onBlankValueChange,
  vybrannayaOblast,
  onVyborOblasti,
}: SheetViewProps) => {
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
                    style={{
                      padding: 0,
                      ...stilYacheyki(kletka.style),
                      ...(kletka.field != null &&
                      kletka.field === vybrannayaOblast
                        ? {
                            outline: `2px solid ${cssVar(semantic.primary)}`,
                            outlineOffset: '-2px',
                          }
                        : {}),
                    }}
                    onClick={
                      onVyborOblasti
                        ? () => {
                            onVyborOblasti(kletka.field ?? null)
                          }
                        : undefined
                    }
                  >
                    {kletka.editable && kletka.field && onBlankValueChange ? (
                      <input
                        type="text"
                        className="w-full bg-transparent outline-none"
                        style={{
                          font: 'inherit',
                          color: 'inherit',
                          textAlign: 'inherit',
                        }}
                        value={blankValues?.[kletka.field] ?? kletka.text ?? ''}
                        onChange={(event) => {
                          onBlankValueChange(kletka.field!, event.target.value)
                        }}
                      />
                    ) : (
                      (kletka.text ?? '')
                    )}
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

/**
 * Дерево страниц бланка — как список страниц формы отчёта в 1С.
 *
 * <p>Страницы самой формы идут верхним уровнем, страницы приложений сворачиваются в узел своего
 * приложения: у формы 200.00 это «200.01» (три страницы), «200.02» (девять), «200.03» (две) и
 * «200.05» (семь). Плоский ряд из двух десятков кнопок читать невозможно, а в эталоне это именно
 * дерево слева от бланка.
 */
const SpisokStranits = ({
  sheets,
  aktivnyy,
  onVybor,
}: {
  sheets: ReportSpreadsheetSheetDto[]
  aktivnyy: number
  onVybor: (indeks: number) => void
}) => {
  const [svernutye, setSvernutye] = useState<Record<string, boolean>>({})

  // Имя листа приложения — «200.01 стр.1»; до пробела стоит номер приложения, он и даёт узел.
  const uzly: {
    prilozhenie: string | null
    stranitsy: { title: string; indeks: number }[]
  }[] = []
  sheets.forEach((s, indeks) => {
    const prilozhenie = /^\d/.test(s.title) ? s.title.split(' ')[0] : null
    const posledniy = uzly.at(-1)
    if (prilozhenie != null && posledniy?.prilozhenie === prilozhenie) {
      posledniy.stranitsy.push({ title: s.title, indeks })
      return
    }
    uzly.push({ prilozhenie, stranitsy: [{ title: s.title, indeks }] })
  })

  const knopka = (title: string, indeks: number, vlozhennaya: boolean) => (
    <button
      key={indeks}
      type="button"
      onClick={() => {
        onVybor(indeks)
      }}
      className={`w-full rounded px-2 py-1 text-left text-sm ${
        vlozhennaya ? 'pl-6' : ''
      } ${
        indeks === aktivnyy
          ? 'bg-blue-50 font-medium text-blue-700'
          : 'text-ui-05 hover:bg-pending-gray-7'
      }`}
    >
      {title}
    </button>
  )

  return (
    <div className="max-h-full w-56 shrink-0 overflow-auto border-r border-pending-gray-6 pr-2">
      {uzly.map((uzel) =>
        uzel.prilozhenie == null ? (
          uzel.stranitsy.map((s) => knopka(s.title, s.indeks, false))
        ) : (
          <Prilozhenie
            key={uzel.prilozhenie}
            nomer={uzel.prilozhenie}
            stranitsy={uzel.stranitsy}
            svernuto={svernutye[uzel.prilozhenie] ?? false}
            onPereklyuchit={() => {
              const nomer = uzel.prilozhenie!
              setSvernutye((prev) => ({ ...prev, [nomer]: !prev[nomer] }))
            }}
            knopka={knopka}
          />
        )
      )}
    </div>
  )
}

/** Узел приложения в дереве страниц: заголовок со стрелкой и вложенные страницы. */
const Prilozhenie = ({
  nomer,
  stranitsy,
  svernuto,
  onPereklyuchit,
  knopka,
}: {
  nomer: string
  stranitsy: { title: string; indeks: number }[]
  svernuto: boolean
  onPereklyuchit: () => void
  knopka: (
    title: string,
    indeks: number,
    vlozhennaya: boolean
  ) => React.ReactNode
}) => (
  <div>
    <button
      type="button"
      onClick={onPereklyuchit}
      className="w-full rounded px-2 py-1 text-left text-sm font-medium text-ui-05 hover:bg-pending-gray-7"
    >
      {svernuto ? '▸' : '▾'} Приложение {nomer}
    </button>
    {!svernuto &&
      stranitsy.map((s) =>
        knopka(s.title.replace(`${nomer} `, ''), s.indeks, true)
      )}
  </div>
)

export const SpreadsheetView = ({
  spreadsheet,
  blankValues,
  onBlankValueChange,
  vybrannayaOblast,
  onVyborOblasti,
}: SpreadsheetViewProps) => {
  const sheets = spreadsheet.sheets
  const [aktivnyy, setAktivnyy] = useState(0)
  if (sheets.length === 0) return null
  const sheet = sheets[Math.min(aktivnyy, sheets.length - 1)]
  return (
    <div className="flex min-h-0 gap-3">
      {sheets.length > 1 && (
        <SpisokStranits
          sheets={sheets}
          aktivnyy={aktivnyy}
          onVybor={setAktivnyy}
        />
      )}
      <div className="min-w-0 flex-1 overflow-auto">
        <SheetView
          sheet={sheet}
          blankValues={blankValues}
          onBlankValueChange={onBlankValueChange}
          vybrannayaOblast={vybrannayaOblast}
          onVyborOblasti={onVyborOblasti}
        />
      </div>
    </div>
  )
}
