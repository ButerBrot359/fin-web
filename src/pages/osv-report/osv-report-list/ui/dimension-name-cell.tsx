import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type { OsvReportEntry } from '../types/osv-report'
import { SubkontoNameCell } from './subkonto-name-cell'

interface DimensionNameCellProps {
  /** Узел дерева ОСВ (дочерняя строка измерения или субконто-лист). */
  node: OsvReportEntry
}

/**
 * Ячейка «Наименование» дочернего узла ОСВ при многоуровневом разворачивании
 * по измерениям (`groupByDimensions=true`).
 *
 * Решение, что показать:
 * - лист SUBKONTO (`groupLevel === 'SUBKONTO'` или есть `subkonto`) —
 *   делегирует {@link SubkontoNameCell}, который резолвит ID → имя через
 *   справочник (как и раньше);
 * - узел измерения (ORGANIZATION/PODRAZDELENIE/FKR/SPETSIFIKA/
 *   ISTOCHNIK_FINANSIROVANIYA) — показывает готовое `groupRefName` от бэка
 *   (резолвить не нужно), а при `null` — i18n-метку «Без значения».
 */
export const DimensionNameCell = ({ node }: DimensionNameCellProps) => {
  const { t } = useTranslation()

  if (node.groupLevel === 'SUBKONTO' || node.subkonto != null) {
    return <SubkontoNameCell subkonto={node.subkonto} />
  }

  // groupRefName может быть null (нет значения) или пустой строкой —
  // в обоих случаях показываем «<...>» (как пустая аналитика в 1С).
  const name = node.groupRefName?.trim()
  return (
    <Typography variant="body2" noWrap className="text-ui-06">
      {name ? name : t('osv.noValue')}
    </Typography>
  )
}
