import type { ItogiRow } from './itogi-columns'

export function itogiParentIds(rows: ItogiRow[]): Set<string> {
  const parents = new Set<string>()
  for (const row of rows) {
    if (row.__parentRowId) parents.add(row.__parentRowId)
  }
  return parents
}

export function visibleItogiRows(
  rows: ItogiRow[],
  open: ReadonlySet<string>
): ItogiRow[] {
  const byParent = new Map<string | null, ItogiRow[]>()
  for (const row of rows) {
    const key = row.__parentRowId ?? null
    const list = byParent.get(key)
    if (list) list.push(row)
    else byParent.set(key, [row])
  }
  const out: ItogiRow[] = []
  const walk = (parent: string | null) => {
    for (const row of byParent.get(parent) ?? []) {
      out.push(row)
      if (open.has(row.rowId)) walk(row.rowId)
    }
  }
  walk(null)
  return out
}
