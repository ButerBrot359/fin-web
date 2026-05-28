import type { AccountPlanEntryDto } from '@/entities/account-plan'

export interface AccountPlanRow {
  entry: AccountPlanEntryDto
  depth: number
  hasChildren: boolean
  isExpanded: boolean
}

/**
 * Сплющиваем дерево счетов в плоский список строк с учётом раскрытых узлов.
 * Сортировка — по `code` лексикографически («10.01» < «10.02» < «20»).
 */
export const buildTreeRows = (
  entries: AccountPlanEntryDto[],
  expandedIds: number[]
): AccountPlanRow[] => {
  const expanded = new Set(expandedIds)

  const childrenByParent = new Map<number | null, AccountPlanEntryDto[]>()
  for (const e of entries) {
    const key = e.parentId ?? null
    const arr = childrenByParent.get(key) ?? []
    arr.push(e)
    childrenByParent.set(key, arr)
  }
  for (const arr of childrenByParent.values()) {
    arr.sort((a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true })
    )
  }

  const rows: AccountPlanRow[] = []
  const walk = (parentId: number | null, depth: number) => {
    const children = childrenByParent.get(parentId) ?? []
    for (const entry of children) {
      const kids = childrenByParent.get(entry.id) ?? []
      const hasChildren = kids.length > 0 || entry.isGroup
      const isExpanded = expanded.has(entry.id)
      rows.push({ entry, depth, hasChildren, isExpanded })
      if (hasChildren && isExpanded) {
        walk(entry.id, depth + 1)
      }
    }
  }
  walk(null, 0)
  return rows
}

/**
 * Фильтрация дерева — оставляем матчи + всех их предков. nameKz сейчас
 * может быть null, поэтому проверяем безопасно.
 */
export const filterTreeByQuery = (
  entries: AccountPlanEntryDto[],
  query: string
): AccountPlanEntryDto[] => {
  const q = query.trim().toLowerCase()
  if (!q) return entries

  const byId = new Map(entries.map((e) => [e.id, e]))
  const matched = new Set<number>()

  for (const e of entries) {
    const nameKz = e.nameKz ?? ''
    if (
      e.code.toLowerCase().includes(q) ||
      e.nameRu.toLowerCase().includes(q) ||
      nameKz.toLowerCase().includes(q)
    ) {
      matched.add(e.id)
      let parent: number | null = e.parentId
      while (parent !== null && !matched.has(parent)) {
        matched.add(parent)
        parent = byId.get(parent)?.parentId ?? null
      }
    }
  }

  return entries.filter((e) => matched.has(e.id))
}
