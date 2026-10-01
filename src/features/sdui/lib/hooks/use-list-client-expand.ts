import { useCallback, useMemo, useState } from 'react'

import type { ViewNode } from '../../types/view'
import type { ListSource } from '../../ui/nodes/composite/list-column-defs'
import { isTreeDisplayMode } from '../utils/list-tree-mode'

/**
 * SCRUM-360 #3: клиентское раскрытие дерева (`props.expandMode === "CLIENT"`).
 *
 * Панель «Родитель» GROUP-поля приходит деревом (`displayMode=TREE`), но
 * серверной команды раскрытия у неё нет — раскрытием владеет клиент: множество
 * раскрытых id подставляется в `source.params.expanded` (CSV) и дерево
 * перезапрашивается тем же `/search?view=tree`. Остальные параметры источника
 * (`view`, `groupsOnly`) уходят в каждом запросе целиком, включая поисковый.
 *
 * Начальное множество — серверный сид из `source.params.expanded`: предки
 * записи, стоящей в поле (панель открывается с раскрытым путём к ней).
 */
export const useListClientExpand = (
  node: ViewNode,
  source: ListSource | undefined
) => {
  const isClientExpand =
    isTreeDisplayMode(node) &&
    (node.props?.expandMode as string | undefined) === 'CLIENT'

  const [expandedIds, setExpandedIds] = useState<ReadonlySet<number>>(
    () =>
      new Set(
        (source?.params?.expanded ?? '')
          .split(',')
          .map((token) => token.trim())
          .filter((token) => token !== '')
          .map(Number)
          .filter((id) => Number.isFinite(id))
      )
  )

  // Желаемое состояние, не переключатель — как у серверного toggleExpand.
  // useCallback — колбэк сидит в deps useMemo колонок (use-list-columns):
  // нестабильная ссылка пересобирала бы column defs на каждом рендере.
  const onToggleExpand = useCallback((rowId: number, expanded: boolean) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (expanded) next.add(rowId)
      else next.delete(rowId)
      return next
    })
  }, [])

  const params = useMemo(() => {
    if (!isClientExpand) return undefined
    const base: Record<string, string> = { ...(source?.params ?? {}) }
    const csv = [...expandedIds].sort((a, b) => a - b).join(',')
    if (csv) base.expanded = csv
    else delete base.expanded
    return base
  }, [isClientExpand, source, expandedIds])

  return {
    isClientExpand,
    /** Параметры источника с клиентским `expanded`; undefined вне режима. */
    params,
    onToggleExpand: isClientExpand ? onToggleExpand : undefined,
  }
}
