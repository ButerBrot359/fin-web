import { useMemo } from 'react'
import { Typography } from '@mui/material'

import type {
  ReportColumnDto,
  ReportResultDto,
} from '@/pages/reports/report-list/types/report'

import { formatReportTitle } from '../lib/format-title'
import { LedgerTable } from './ledger-table'
import { TreeTable } from './tree-table'

interface ReportResultViewProps {
  result: ReportResultDto
  /** Коды колонок, скрытых настройками (показатели/группировка). */
  hiddenColumns?: Set<string>
}

/**
 * Единый 1С-fidelity рендерер результата отчёта (ReportResultDto). Над таблицей
 * — жирный заголовок из `titleTemplate`+`appliedTitleValues`. Диспатч по
 * `result.layout`: `LEDGER` ⇒ плоский регистр (карточка-счёта-стиль со span-
 * строками сальдо/оборотов), иначе (`TREE`/отсутствие) ⇒ раскрываемое дерево.
 * Денежный формат, знак и многострочная аналитика — общие для обоих режимов.
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

  return (
    <div className="flex flex-col gap-3">
      {title && (
        <Typography variant="body1" className="font-bold text-ui-06">
          {title}
        </Typography>
      )}
      {isLedger ? (
        <LedgerTable result={result} columns={columns} />
      ) : (
        <TreeTable result={result} columns={columns} />
      )}
    </div>
  )
}
