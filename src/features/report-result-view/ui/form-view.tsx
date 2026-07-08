import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import type {
  ReportColumnDto,
  ReportFormDto,
  ReportFormSectionDto,
} from '@/pages/reports/report-list/types/report'

import { isHighlightRow, isRightAligned } from '../lib/cell-helpers'
import { ReportCell } from './report-cell'

/** Сетка бланка: тонкие серые линии, плотные ячейки (как табличный документ 1С). */
const td = 'border border-[#d9d9d9] px-1.5 py-0.5 align-top'
const th = 'border border-[#d9d9d9] px-1.5 py-1 text-center align-middle'

/** Ширина одного символа колонки (`width` приходит в символах, как в 1С). */
const CHAR_PX = 8

/** Локализованный заголовок колонки. */
const columnTitle = (col: ReportColumnDto, isKz: boolean): string =>
  (isKz ? col.titleKz : col.titleRu) || col.titleRu

/** Локализованный верхний ряд шапки (группа «Дебет субсчетов» и т.п.); '' ⇒ нет. */
const columnGroupTitle = (col: ReportColumnDto, isKz: boolean): string =>
  ((isKz ? col.groupTitleKz : col.groupTitleRu) || col.groupTitleRu) ?? ''

/** Локализованный средний ряд шапки (подгруппа «7060» и т.п.); '' ⇒ нет. */
const columnSubGroupTitle = (col: ReportColumnDto, isKz: boolean): string =>
  ((isKz ? col.subGroupTitleKz : col.subGroupTitleRu) || col.subGroupTitleRu) ??
  ''

/** Ячейка шапки: заголовок + объединения. */
interface HeadCell {
  key: string
  title: string
  colSpan: number
  rowSpan: number
}

/**
 * Модель многоуровневой шапки бланка — generic для 1/2/3 рядов по наличию
 * `groupTitleRu`/`subGroupTitleRu` (SDUI: рисуем присланное, без хардкода):
 * - ряд 1 (группы): соседние колонки с одинаковым groupTitle → colSpan;
 *   колонка без groupTitle занимает всю высоту шапки (rowSpan=levels);
 * - ряд 2 (подгруппы): внутри группы соседние одинаковые subGroupTitle →
 *   colSpan; колонка группы без subGroupTitle занимает ряды 2–3 (rowSpan=2);
 * - ряд 3 (листья): titleRu каждой колонки.
 */
const buildHeadModel = (
  cols: ReportColumnDto[],
  isKz: boolean
): HeadCell[][] | null => {
  const hasGroup = cols.some((c) => columnGroupTitle(c, isKz))
  const hasSub = cols.some((c) => columnSubGroupTitle(c, isKz))
  const levels = hasSub ? 3 : hasGroup ? 2 : 1
  if (levels === 1) return null

  const row1: HeadCell[] = []
  const row2: HeadCell[] = []
  const row3: HeadCell[] = []

  let i = 0
  while (i < cols.length) {
    const group = columnGroupTitle(cols[i], isKz)
    if (!group) {
      // Колонка без группы — заголовок на всю высоту шапки.
      row1.push({
        key: cols[i].code,
        title: columnTitle(cols[i], isKz),
        colSpan: 1,
        rowSpan: levels,
      })
      i++
      continue
    }
    // Границы группы одинакового groupTitle.
    let j = i
    while (j < cols.length && columnGroupTitle(cols[j], isKz) === group) j++
    row1.push({
      key: `g-${cols[i].code}`,
      title: group,
      colSpan: j - i,
      rowSpan: 1,
    })

    if (levels === 2) {
      for (let k = i; k < j; k++)
        row2.push({
          key: cols[k].code,
          title: columnTitle(cols[k], isKz),
          colSpan: 1,
          rowSpan: 1,
        })
    } else {
      // Средний ряд подгрупп внутри [i, j).
      let k = i
      while (k < j) {
        const sub = columnSubGroupTitle(cols[k], isKz)
        if (!sub) {
          // Колонка группы без подгруппы — заголовок на ряды 2–3.
          row2.push({
            key: cols[k].code,
            title: columnTitle(cols[k], isKz),
            colSpan: 1,
            rowSpan: 2,
          })
          k++
          continue
        }
        let m = k
        while (m < j && columnSubGroupTitle(cols[m], isKz) === sub) m++
        row2.push({
          key: `s-${cols[k].code}`,
          title: sub,
          colSpan: m - k,
          rowSpan: 1,
        })
        for (let p = k; p < m; p++)
          row3.push({
            key: cols[p].code,
            title: columnTitle(cols[p], isKz),
            colSpan: 1,
            rowSpan: 1,
          })
        k = m
      }
    }
    i = j
  }

  return levels === 3 ? [row1, row2, row3] : [row1, row2]
}

/**
 * Таблица одной секции бланка (дебет/кредит субсчёта): многоуровневая шапка
 * (группы/подгруппы/листья), строка сквозной нумерации граф (как в 1С:
 * 1..13, 14..26), DATA-строки и жирная строка «Итого:».
 */
const SectionTable = ({
  section,
  isKz,
}: {
  section: ReportFormSectionDto
  isKz: boolean
}) => {
  const cols = section.columns
  const start = section.graphNumberStart ?? 1
  const headRows = buildHeadModel(cols, isKz)
  return (
    <table className="w-full table-fixed border-collapse bg-white">
      <colgroup>
        {cols.map((c, i) => (
          <col
            key={c.code}
            style={{
              width:
                c.width != null
                  ? c.width * CHAR_PX
                  : i === 0
                    ? 44
                    : c.role === 'PERIOD' || c.role === 'ATTRIBUTE'
                      ? 150
                      : undefined,
            }}
          />
        ))}
      </colgroup>
      <thead>
        {headRows ? (
          headRows.map((cells, ri) => (
            <tr key={ri}>
              {cells.map((cell) => (
                <th
                  key={cell.key}
                  colSpan={cell.colSpan}
                  rowSpan={cell.rowSpan}
                  className={th}
                >
                  <Typography variant="caption" sx={{ color: '#333' }}>
                    {cell.title}
                  </Typography>
                </th>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            {cols.map((col) => (
              <th key={col.code} className={th}>
                <Typography variant="caption" sx={{ color: '#333' }}>
                  {columnTitle(col, isKz)}
                </Typography>
              </th>
            ))}
          </tr>
        )}
        {section.numberGraphs && (
          <tr>
            {cols.map((col, i) => (
              <th key={col.code} className={`${th} py-0`}>
                <Typography variant="caption" sx={{ color: '#333' }}>
                  {start + i}
                </Typography>
              </th>
            ))}
          </tr>
        )}
      </thead>
      <tbody>
        {section.rows.map((row, idx) => {
          const highlight = isHighlightRow(row.rowKind)
          return (
            <tr key={idx}>
              {cols.map((col, ci) => (
                <td
                  key={col.code}
                  className={`${td} ${isRightAligned(col) ? 'text-right' : ci === 0 ? 'text-center' : ''}`}
                >
                  {highlight && ci === 0 && row.labelText ? (
                    <Typography
                      variant="body2"
                      sx={{ color: '#333', fontWeight: 700 }}
                      className="text-center"
                    >
                      {row.labelText}
                    </Typography>
                  ) : (
                    <ReportCell
                      value={row.cells[col.code]}
                      col={col}
                      bold={highlight}
                    />
                  )}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/**
 * Официальный бланк отчёта (мемориальный ордер) — 1 в 1 с печатной формой 1С:
 * правовой гриф и номер формы, организация, заголовок «№ N Мемориальный
 * ордер», период, название накопительной ведомости, секции дебета/кредита
 * субсчёта с графами-кор.счетами и сквозной нумерацией, остатки на
 * начало/конец месяца и подписи.
 */
export const FormView = ({ form }: { form: ReportFormDto }) => {
  const { i18n } = useTranslation()
  const isKz = i18n.language === 'kz'

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-1 bg-white text-[#333]">
      {/* Гриф и номер формы. */}
      <div className="flex items-start justify-between">
        <div>
          {form.legalHeader?.map((line, i) => (
            <Typography
              key={i}
              variant="caption"
              component="div"
              sx={{ color: '#333' }}
            >
              {line}
            </Typography>
          ))}
        </div>
        {form.formNumber && (
          <Typography variant="body2" sx={{ color: '#333', fontWeight: 700 }}>
            {form.formNumber}
          </Typography>
        )}
      </div>

      {/* Организация с подписью поля. */}
      {form.organizationLine && (
        <div className="mt-2">
          <Typography
            variant="body2"
            sx={{ color: '#333' }}
            className="border-b border-[#333] inline-block pr-24"
          >
            {form.organizationLine}
          </Typography>
          {form.organizationCaption && (
            <Typography
              variant="caption"
              component="div"
              sx={{ color: '#666', fontSize: 10 }}
            >
              {form.organizationCaption}
            </Typography>
          )}
        </div>
      )}

      {/* Заголовок бланка. */}
      <div className="mt-3 text-center">
        {form.title && (
          <Typography variant="body1" sx={{ color: '#333', fontWeight: 700 }}>
            {form.title}
          </Typography>
        )}
        {form.periodLine && (
          <Typography variant="body2" sx={{ color: '#333', fontWeight: 700 }}>
            {form.periodLine}
          </Typography>
        )}
        {form.vedomostTitle && (
          <Typography variant="body2" sx={{ color: '#333', fontWeight: 700 }}>
            {form.vedomostTitle}
          </Typography>
        )}
        {form.accountsLine && (
          <Typography variant="body2" sx={{ color: '#333', fontWeight: 700 }}>
            {form.accountsLine}
          </Typography>
        )}
      </div>

      {/* Секции (дебет/кредит субсчёта). */}
      {form.sections.map((section, i) => (
        <div key={i} className="mt-3 flex flex-col gap-1">
          {section.title && (
            <Typography variant="body2" sx={{ color: '#333' }}>
              {section.title}
            </Typography>
          )}
          {section.openingLine && (
            <Typography variant="body2" sx={{ color: '#333', fontWeight: 700 }}>
              {section.openingLine}
            </Typography>
          )}
          <SectionTable section={section} isKz={isKz} />
        </div>
      ))}

      {/* Остатки на конец и подписи. */}
      <div className="mt-2 flex flex-col gap-1">
        {form.footerLines?.map((line, i) => (
          <Typography
            key={i}
            variant="body2"
            sx={{ color: '#333', fontWeight: 700 }}
          >
            {line}
          </Typography>
        ))}
      </div>

      {form.signatures && form.signatures.length > 0 && (
        <div className="mt-6 flex flex-col gap-6">
          {form.signatures.map((sig, i) => (
            <div key={i} className="flex items-end gap-6">
              <Typography
                variant="body2"
                sx={{ color: '#333' }}
                className="w-44 shrink-0"
              >
                {sig.role}
              </Typography>
              {(sig.captions ?? ['подпись']).map((caption, ci) => (
                <div key={ci} className="flex w-48 flex-col items-center">
                  <Typography
                    variant="body2"
                    sx={{ color: '#333' }}
                    className="min-h-5"
                  >
                    {ci === (sig.captions?.length ?? 1) - 1
                      ? (sig.name ?? '')
                      : ''}
                  </Typography>
                  <div className="w-full border-t border-[#333]" />
                  <Typography
                    variant="caption"
                    sx={{ color: '#666', fontSize: 10 }}
                  >
                    {caption}
                  </Typography>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
