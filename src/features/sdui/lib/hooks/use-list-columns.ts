import { useMemo, type RefObject } from 'react'
import type { ColumnDef } from '@tanstack/react-table'

import {
  buildListColumns,
  type ListRow,
  type ListSortState,
} from '../../ui/nodes/composite/list-column-defs'
import type { ViewNode, ViewNodeAction } from '../../types/view'
import type { useSduiDispatch } from '../dispatch'
import { buildToggleExpand } from '../utils/list-tree-mode'

interface UseListColumnsArgs {
  columnNodes: ViewNode[]
  isTree: boolean
  sortState: ListSortState | undefined
  sortCommand: string | undefined
  filterCommand: string | undefined
  filterOpLabels: Record<string, string> | undefined
  expandAction: ViewNodeAction | undefined
  dispatch: ReturnType<typeof useSduiDispatch>
  nodeId: string
  sortInFlightRef: RefObject<boolean>
  /** Строка поиска — подсвечивается в ячейках (обращение 21.09.2026). */
  search?: string
}

/**
 * Column defs LIST-узла. SCRUM-360 v6 §8.1: в дереве нет сортировки кликом по
 * заголовку — состояние и команду сортировки не пробрасываем (стрелка и клик
 * не рендерятся). Вынесено из list-node.tsx при декомпозиции (>300 строк).
 */
export function useListColumns({
  columnNodes,
  isTree,
  sortState,
  sortCommand,
  filterCommand,
  filterOpLabels,
  expandAction,
  dispatch,
  nodeId,
  sortInFlightRef,
  search,
}: UseListColumnsArgs): ColumnDef<ListRow>[] {
  return useMemo<ColumnDef<ListRow>[]>(
    () =>
      buildListColumns({
        columnNodes,
        sortState: isTree ? undefined : sortState,
        sortCommand: isTree ? undefined : sortCommand,
        filterCommand,
        filterOpLabels,
        dispatch,
        nodeId,
        sortInFlightRef,
        search,
        onToggleExpand: buildToggleExpand(
          isTree,
          expandAction,
          dispatch,
          nodeId
        ),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      columnNodes,
      sortState,
      sortCommand,
      filterCommand,
      dispatch,
      nodeId,
      filterOpLabels,
      isTree,
      expandAction,
      search,
    ]
  )
}
