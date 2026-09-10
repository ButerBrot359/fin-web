import type { ViewNode } from '../../types/view'

/**
 * Колонки табличных частей для диалога «Изменить форму» (запрос владельца
 * 11.09: «во вкладках же тоже есть элементы»). Управление — только
 * видимостью: рендер таблиц уже фильтрует колонки по `visible === false`
 * (build-column-defs), так что патч работает без правок таблиц.
 */
export interface TableColumnItem {
  nodeId: string
  label: string
  hidden: boolean
}

export interface TableColumnsGroup {
  tableId: string
  columns: TableColumnItem[]
}

/** Колонки всех таблиц формы, сгруппированные по id таблицы. */
export function collectTableColumns(
  root: ViewNode | null,
  hiddenByUser: ReadonlySet<string>
): Map<string, TableColumnItem[]> {
  const groups = new Map<string, TableColumnItem[]>()
  if (!root) return groups
  walk(root, groups, hiddenByUser)
  return groups
}

function walk(
  node: ViewNode,
  groups: Map<string, TableColumnItem[]>,
  hiddenByUser: ReadonlySet<string>
): void {
  if (node.type === 'TABLE') {
    const columns: TableColumnItem[] = []
    for (const child of node.children ?? []) {
      if (child.type !== 'TABLE_COLUMN') continue
      const label = child.props?.label
      if (typeof label !== 'string' || label.trim() === '') continue
      const userHidden = hiddenByUser.has(child.id)
      const serverHidden = child.props?.visible === false && !userHidden
      if (serverHidden) continue
      columns.push({ nodeId: child.id, label, hidden: userHidden })
    }
    if (columns.length > 0) groups.set(node.id, columns)
    return
  }
  for (const child of node.children ?? []) {
    walk(child, groups, hiddenByUser)
  }
}
