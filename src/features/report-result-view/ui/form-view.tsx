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

/** Локализованный заголовок колонки. */
const columnTitle = (col: ReportColumnDto, isKz: boolean): string =>
  (isKz ? col.titleKz : col.titleRu) || col.titleRu

/**
 * Таблица одной секции бланка (дебет/кредит субсчёта): шапка из колонок
 * секции, строка сквозной нумерации граф (как в 1С: 1..13, 14..26),
 * DATA-строки и жирная строка «Итого:».
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
  return (
    <table className="w-full table-fixed border-collapse bg-white">
      <colgroup>
        {cols.map((c, i) => (
          <col
            key={c.code}
            style={{
              width:
                i === 0
                  ? 44
                  : c.role === 'PERIOD' || c.role === 'ATTRIBUTE'
                    ? 150
                    : undefined,
            }}
          />
        ))}
      </colgroup>
      <thead>
        <tr>
          {cols.map((col) => (
            <th key={col.code} className={th}>
              <Typography variant="caption" sx={{ color: '#333' }}>
                {columnTitle(col, isKz)}
              </Typography>
            </th>
          ))}
        </tr>
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
