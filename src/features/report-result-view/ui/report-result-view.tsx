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

/** Настройки вкладки «Оформление» (проброс из панели настроек отчёта). */
export interface ReportResultAppearance {
  /** Выделять отрицательные значения красным. */
  highlightNegatives: boolean
  /** Уменьшенный автоотступ уровней дерева. */
  reducedIndent: boolean
}

interface ReportResultViewProps {
  result: ReportResultDto
  /** Коды колонок, скрытых настройками (показатели/группировка). */
  hiddenColumns?: Set<string>
  /** Оформление (вкладка «Оформление»). Отсутствие ⇒ текущее поведение 1С. */
  appearance?: ReportResultAppearance
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
  appearance,
}: ReportResultViewProps) => {
  // Скрываем колонки, выключенные настройками (показатели/группировка), и —
  // когда «Выделять отрицательные» выключено — гасим negativeRed на колонках
  // (эффективно отключает красную окраску во всех ячейках, включая итоги).
  const columns = useMemo<ReportColumnDto[]>(() => {
    const base =
      hiddenColumns && hiddenColumns.size > 0
        ? result.columns.filter((c) => !hiddenColumns.has(c.code))
        : result.columns
    if (appearance && !appearance.highlightNegatives) {
      return base.map((c) => (c.negativeRed ? { ...c, negativeRed: false } : c))
    }
    return base
  }, [result.columns, hiddenColumns, appearance])

  // Автоотступ уровней дерева: 8px при «Уменьшенный автоотступ», иначе 13px
  // (дефолт = текущее поведение, когда appearance не задан).
  const indentPx = appearance ? (appearance.reducedIndent ? 8 : 13) : 13

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
          <TreeTable result={result} columns={columns} indentPx={indentPx} />
        )}
      </div>
    </div>
  )
}
