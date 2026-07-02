import { useMemo } from 'react'
import { Typography } from '@mui/material'

import type {
  ReportColumnDto,
  ReportResultDto,
} from '@/pages/reports/report-list/types/report'

import { formatReportTitle } from '../lib/format-title'
import { FormView } from './form-view'
import { LedgerTable } from './ledger-table'
import { TreeTable } from './tree-table'

interface ReportResultViewProps {
  result: ReportResultDto
  /** Коды колонок, скрытых настройками (показатели/группировка). */
  hiddenColumns?: Set<string>
}

/**
 * Единый 1С-fidelity рендерер результата отчёта (ReportResultDto). Шапка как в
 * табличном документе 1С: строка организации (жирная) → заголовок отчёта
 * (жирный, крупный) → строки «Выводимые данные: …». Диспатч по `result.layout`:
 * `LEDGER` ⇒ плоский регистр (карточка-счёта-стиль со span-строками),
 * иначе (`TREE`/отсутствие) ⇒ раскрываемое дерево.
 */
export const ReportResultView = ({
  result,
  hiddenColumns,
}: ReportResultViewProps) => {
  // Скрываем колонки, выключенные настройками (показатели/группировка).
  const columns = useMemo<ReportColumnDto[]>(
    () =>
      hiddenColumns && hiddenColumns.size > 0
        ? result.columns.filter((c) => !hiddenColumns.has(c.code))
        : result.columns,
    [result.columns, hiddenColumns]
  )

  const title = formatReportTitle(result)
  const isLedger = result.layout === 'LEDGER'

  // Официальный бланк (мемориальный ордер) — своя шапка, заголовок не нужен.
  if (result.layout === 'FORM' && result.form) {
    return <FormView form={result.form} />
  }

  return (
    <div className="flex flex-col gap-1">
      {result.organizationTitle && (
        <Typography variant="body2" sx={{ color: '#333', fontWeight: 700 }}>
          {result.organizationTitle}
        </Typography>
      )}
      {title && (
        <Typography
          variant="body1"
          sx={{ color: '#333', fontWeight: 700, fontSize: 17 }}
        >
          {title}
        </Typography>
      )}
      {result.subtitleLines?.map((line, i) => (
        <Typography key={i} variant="caption" sx={{ color: '#333' }}>
          {line}
        </Typography>
      ))}
      <div className="mt-2">
        {isLedger ? (
          <LedgerTable result={result} columns={columns} />
        ) : (
          <TreeTable result={result} columns={columns} />
        )}
      </div>
    </div>
  )
}
