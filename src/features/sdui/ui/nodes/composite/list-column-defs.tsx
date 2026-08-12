// SCRUM-291: колоночные типы и билдер column defs LIST — вынесены из
// list-node.tsx (split на файлы < 300 строк). Логика перенесена verbatim;
// единственное изменение — заголовок колонки теперь рендерится через
// <ListSortHeader> (клавиатурная активация сортировки, см. list-sort-header.tsx).
import { Typography } from '@mui/material'
import type { ColumnDef } from '@tanstack/react-table'
import type { RefObject } from 'react'
import { formatSduiCellValue } from '../../../lib/format-cell'
import { getCellIcon } from './cell-icon-registry'
import { ListSortHeader } from './list-sort-header'
import {
  ListFilterFunnel,
  type ListFilterFunnelColumn,
} from './list-filter-funnel'
import type {
  FilterEnumOption,
  FilterValueSource,
} from './list-filter-value-control'
import type { ViewNode } from '../../../types/view'
import type { useSduiDispatch } from '../../../lib/dispatch'

export interface ListSource {
  url: string
  params?: Record<string, string>
  method?: string
  body?: unknown
}

export interface ListRow {
  id: number
  [key: string]: unknown
  attributes?: Record<string, unknown>
}

export interface ListSortState {
  column: string
  dir: 'ASC' | 'DESC'
}

export interface ListPeriod {
  from: string | null
  to: string | null
}

const resolveBinding = (row: ListRow, binding: string): unknown =>
  row[binding] ?? row.attributes?.[binding] ?? ''

export interface BuildListColumnsArgs {
  columnNodes: ViewNode[]
  sortState: ListSortState | undefined
  typeCode: string | undefined
  filterOpLabels: Record<string, string> | undefined
  dispatch: ReturnType<typeof useSduiDispatch>
  nodeId: string
  sortInFlightRef: RefObject<boolean>
}

export const buildListColumns = (
  args: BuildListColumnsArgs
): ColumnDef<ListRow>[] => {
  const { columnNodes, sortState, typeCode, filterOpLabels, dispatch, nodeId } =
    args

  return columnNodes.map((col: ViewNode) => {
    const attributeCode = (col.props?.attributeCode ?? col.props?.binding) as
      | string
      | undefined
    const canSort =
      col.props?.sortable === true && !!typeCode && !!attributeCode

    // SCRUM-291 2c: метаданные воронки — ВСЕГДА filterField (не attributeCode,
    // см. алиас «Номер»→"code" в design §2c/§7). filterOps пусто/нет → воронки нет.
    const filterField = col.props?.filterField as string | undefined
    const filterOps = (col.props?.filterOps as string[] | undefined) ?? []
    const canFilter = !!typeCode && !!filterField && filterOps.length > 0
    const filterColumn: ListFilterFunnelColumn = {
      filterField: filterField ?? '',
      filterOps,
      dataType: col.props?.dataType as string | undefined,
      filterValueSource: col.props?.filterValueSource as
        | FilterValueSource
        | undefined,
      filterValueOptions: col.props?.filterValueOptions as
        | FilterEnumOption[]
        | undefined,
    }

    const handleHeaderClick = canSort
      ? () => {
          if (args.sortInFlightRef.current) return
          const column = attributeCode
          const dir =
            sortState?.column === column
              ? sortState.dir === 'ASC'
                ? 'DESC'
                : 'ASC'
              : 'ASC'
          args.sortInFlightRef.current = true
          void Promise.resolve(
            dispatch({
              type: 'COMMAND',
              command: `list.applySort:${typeCode}`,
              value: { column, dir },
              sourceNodeId: nodeId,
            })
          ).finally(() => {
            args.sortInFlightRef.current = false
          })
        }
      : undefined

    return {
      id: col.id,
      header: () => {
        const label = (col.props?.header as string) || ''
        const arrowDir =
          sortState && attributeCode && sortState.column === attributeCode
            ? sortState.dir
            : undefined

        return (
          <ListSortHeader
            label={label}
            arrowDir={arrowDir}
            onSort={handleHeaderClick}
            funnel={
              canFilter ? (
                <ListFilterFunnel
                  column={filterColumn}
                  filterOpLabels={filterOpLabels}
                  onApply={(field, op, value) => {
                    void dispatch({
                      type: 'COMMAND',
                      command: `list.applyFilter:${typeCode}`,
                      value:
                        value === undefined
                          ? { field, op }
                          : { field, op, value },
                      sourceNodeId: nodeId,
                    })
                  }}
                />
              ) : null
            }
          />
        )
      },
      accessorFn: (row: ListRow) => {
        const binding = (col.props?.attributeCode ??
          col.props?.binding) as string
        if (!binding) return ''
        const val = resolveBinding(row, binding)
        if (val && typeof val === 'object') {
          const obj = val as Record<string, unknown>
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          return (obj.presentation ?? String(obj.id ?? '')) as string
        }
        return formatSduiCellValue(
          val,
          col.props?.dataType as string | undefined
        )
      },
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      size: (col.props?.width as number) ?? 150,
      // SCRUM-291 3b (§17.2): cellKind="ICON" — значение ячейки (строка
      // "true"/"false", тот же примитивный формат, что у остальных ячеек)
      // маппится через props.iconMap на имя иконки и рендерится глифом;
      // неизвестное/отсутствующее имя → пустая ячейка, не текст "true"/"false".
      cell:
        // SCRUM-360 блок H: колонка иерархии — глиф группа/элемент (iconMap,
        // ключ String(_isGroup) — тот же словарь, что у ICON) + отступ по
        // уровню вложенности _level. Контракт строки — Q-2 к бэку; фолбэки:
        // нет _level → 0 (плоско), нет глифа → только текст.
        col.props?.cellKind === 'HIERARCHY'
          ? (info: { getValue: () => unknown; row: { original: ListRow } }) => {
              const iconMap = col.props?.iconMap as
                | Record<string, string>
                | undefined
              const { _level, _isGroup } = info.row.original
              const level =
                typeof _level === 'number' && _level > 0 ? _level : 0
              // eslint-disable-next-line @typescript-eslint/no-base-to-string
              const Icon = getCellIcon(iconMap?.[String(_isGroup ?? '')])
              return (
                <span
                  className="flex items-center gap-1.5"
                  style={{ paddingLeft: level * 16 }}
                >
                  {Icon ? (
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  ) : null}
                  <Typography variant="body2" noWrap className="text-ui-06">
                    {/* eslint-disable-next-line @typescript-eslint/no-base-to-string */}
                    {String(info.getValue() ?? '')}
                  </Typography>
                </span>
              )
            }
          : col.props?.cellKind === 'ICON'
            ? (info: { getValue: () => unknown }) => {
                const iconMap = col.props?.iconMap as
                  | Record<string, string>
                  | undefined
                // eslint-disable-next-line @typescript-eslint/no-base-to-string
                const value = String(info.getValue() ?? '')
                const Icon = getCellIcon(iconMap?.[value])
                return Icon ? (
                  <Icon aria-hidden="true" className="h-4 w-4" />
                ) : null
              }
            : (info: { getValue: () => unknown }) => (
                <Typography variant="body2" noWrap className="text-ui-06">
                  {/* eslint-disable-next-line @typescript-eslint/no-base-to-string */}
                  {String(info.getValue() ?? '')}
                </Typography>
              ),
    }
  })
}
