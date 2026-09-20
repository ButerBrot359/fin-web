import { type FC } from 'react'
import { Typography } from '@mui/material'

import type { ViewNode } from '../../../types/view'

import {
  ListFilterValueControl,
  type ColumnFilterValueMeta,
  type FilterEnumOption,
  type FilterValueSource,
} from './list-filter-value-control'

export interface ListQuickFilter {
  field: string
  label: string
  op: string
  column: ColumnFilterValueMeta
  value: unknown
}

interface ListQuickFiltersProps {
  filters: ListQuickFilter[]
  onApply: (field: string, op: string, value: unknown) => void
}

/**
 * Панель отбора над таблицей — как в журнале 1С, где над списком стоят «Организация»,
 * «Форма», «Период». Показывает поля, которые сервер объявил в `props.quickFilterFields`,
 * и шлёт ту же команду фильтра, что и воронка колонки: вторая логика фильтрации не заводится.
 */
export const ListQuickFilters: FC<ListQuickFiltersProps> = ({
  filters,
  onApply,
}) => {
  if (filters.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-4">
      {filters.map((filter) => (
        <div key={filter.field} className="flex items-center gap-2">
          <Typography variant="body2" className="whitespace-nowrap text-ui-05">
            {filter.label}
          </Typography>
          <div className="w-56">
            <ListFilterValueControl
              op={filter.op}
              column={filter.column}
              value={filter.value}
              onChange={(value) => {
                onApply(filter.field, filter.op, value)
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Подпись поля панели: сервер кладёт заголовок колонки списка в `header` (NodeProps.HEADER),
 * `title`/`label` у колонки нет вовсе — пока панель читала только их, пользователь видел
 * технический код поля («Organizatsiya» вместо «Организация», обращение 20.09.2026).
 * Нестроковые значения игнорируются: подписью может быть только строка.
 */
const podpisKolonki = (
  props: Record<string, unknown> | undefined,
  field: string
): string => {
  for (const key of ['header', 'title', 'label']) {
    const raw = props?.[key]
    if (typeof raw === 'string' && raw.trim() !== '') return raw
  }
  return field
}

/** Разбор `quickFilterFields` в готовые к отрисовке поля панели. */
export const readQuickFilters = (
  node: ViewNode,
  columnNodes: ViewNode[],
  appliedValues: Record<string, unknown>
): ListQuickFilter[] => {
  const fields = node.props?.quickFilterFields
  if (!Array.isArray(fields)) return []

  // Поле панели может не иметь колонки в списке: состав панели берётся из эталона формы 1С,
  // а там встречаются отборы по реквизитам, которых среди колонок нет («Подразделение» у
  // «Корректировки параметров учёта ОС»). Для таких полей сервер шлёт метаданные отдельно.
  const metaPoPolyu = (node.props?.quickFilterMeta ?? {}) as Record<
    string,
    Record<string, unknown> | undefined
  >

  return fields.flatMap((raw) => {
    const field = String(raw)
    const column =
      columnNodes.find((c) => c.props?.filterField === field) ??
      (metaPoPolyu[field] ? { props: metaPoPolyu[field] } : undefined)
    if (!column) return []

    const ops = column.props?.filterOps
    const defaultOp = column.props?.filterDefaultOp
    const op =
      typeof defaultOp === 'string'
        ? defaultOp
        : Array.isArray(ops) && ops.length > 0
          ? String(ops[0])
          : 'equals'

    return [
      {
        field,
        label: podpisKolonki(column.props, field),
        op,
        column: {
          dataType: column.props?.dataType as string | undefined,
          filterValueSource: column.props?.filterValueSource as
            | FilterValueSource
            | undefined,
          filterValueOptions: column.props?.filterValueOptions as
            | FilterEnumOption[]
            | undefined,
        },
        value: appliedValues[field],
      },
    ]
  })
}
