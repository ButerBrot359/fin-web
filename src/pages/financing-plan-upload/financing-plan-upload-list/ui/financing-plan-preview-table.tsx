import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'

import {
  PERIOD_INDICES,
  type ParsedRow,
  type PeriodKey,
} from '../types/financing-plan-upload'

interface FinancingPlanPreviewTableProps {
  rows: ParsedRow[]
}

const td = 'border border-ui-04/60 px-3 py-1.5 align-top'
const th =
  'overflow-hidden whitespace-nowrap border border-ui-04/60 px-3 py-2 text-left text-xs font-semibold uppercase text-ui-06'

/** Денежная ячейка: разряды, пусто для 0. */
const Money = ({ v }: { v: number }) => (
  <Typography
    variant="body2"
    noWrap
    className="text-right tabular-nums text-ui-06"
  >
    {v === 0 ? '' : formatWithSpaces(String(v))}
  </Typography>
)

/**
 * Предпросмотр распарсенных строк плана финансирования: ФКР, специфика,
 * 12 месяцев + итог. Строки с ошибками подсвечены красным, с предупреждениями —
 * жёлтым; сами тексты ошибок/предупреждений выводятся под номером строки.
 */
export const FinancingPlanPreviewTable = ({
  rows,
}: FinancingPlanPreviewTableProps) => {
  const { t } = useTranslation()

  if (rows.length === 0) return null

  return (
    <div className="overflow-auto">
      <table className="w-max border-collapse text-sm">
        <thead>
          <tr>
            <th className={th}>{t('financingPlanUpload.columns.rowNumber')}</th>
            <th className={th}>{t('financingPlanUpload.columns.fkr')}</th>
            <th className={th}>
              {t('financingPlanUpload.columns.spetsifika')}
            </th>
            {PERIOD_INDICES.map((m) => (
              <th key={m} className={`${th} text-right`}>
                {t('financingPlanUpload.columns.month', { month: m })}
              </th>
            ))}
            <th className={`${th} text-right`}>
              {t('financingPlanUpload.columns.total')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const hasErrors = row.errors.length > 0
            const hasWarnings = row.warnings.length > 0
            const rowClass = hasErrors
              ? 'bg-support-01/10'
              : hasWarnings
                ? 'bg-accent-01/15'
                : ''
            return (
              <tr key={row.rowNumber} className={rowClass}>
                <td className={td}>
                  <div className="font-medium text-ui-06">{row.rowNumber}</div>
                  {hasErrors && (
                    <div className="mt-1 text-xs text-support-01">
                      {row.errors.join('; ')}
                    </div>
                  )}
                  {hasWarnings && (
                    <div className="mt-1 text-xs text-ui-05">
                      {row.warnings.join('; ')}
                    </div>
                  )}
                </td>
                <td className={td}>
                  <div className="font-medium text-ui-06">
                    {row.fkrCode ?? ''}
                  </div>
                  {row.fkrNameRu && (
                    <div className="text-xs text-ui-05">{row.fkrNameRu}</div>
                  )}
                </td>
                <td className={td}>
                  <div className="font-medium text-ui-06">
                    {row.spetsifikaCode ?? ''}
                  </div>
                  {row.spetsifikaNameRu && (
                    <div className="text-xs text-ui-05">
                      {row.spetsifikaNameRu}
                    </div>
                  )}
                </td>
                {PERIOD_INDICES.map((m) => (
                  <td key={m} className={td}>
                    <Money v={row[`summaPeriod${String(m)}` as PeriodKey]} />
                  </td>
                ))}
                <td className={td}>
                  <Typography
                    variant="body2"
                    noWrap
                    className="text-right tabular-nums font-bold text-ui-06"
                  >
                    {row.summaItogo === 0
                      ? ''
                      : formatWithSpaces(String(row.summaItogo))}
                  </Typography>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
