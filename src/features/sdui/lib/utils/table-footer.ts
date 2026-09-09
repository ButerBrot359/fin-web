import type { ViewNode } from '../../types/view'
import type { TableRow } from '../hooks/use-table-sync'

const SUM = 'SUM'

function toNumber(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0
  if (typeof raw === 'string') {
    const normalized = raw.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function columnBinding(node: ViewNode): string {
  return node.binding ?? (node.props?.binding as string | undefined) ?? node.id
}

function isSumFooterColumn(node: ViewNode): boolean {
  if (node.props?.footer !== true) return false
  const agg = (node.props.footerAgg as string | undefined) ?? SUM
  return agg === SUM
}

function collect(
  nodes: ViewNode[] | undefined,
  out: Map<string, string>
): void {
  for (const node of nodes ?? []) {
    if (node.type === 'TABLE_COLUMN' && isSumFooterColumn(node)) {
      out.set(node.id, columnBinding(node))
    }
    collect(node.children, out)
  }
}

export function sumVisibleFooter(
  columns: ViewNode[] | undefined,
  rows: TableRow[]
): Record<string, number> {
  const bindings = new Map<string, string>()
  collect(columns, bindings)

  const totals: Record<string, number> = {}
  bindings.forEach((binding, key) => {
    let sum = 0
    for (const row of rows) sum += toNumber(row[binding])
    totals[key] = sum
  })
  return totals
}
