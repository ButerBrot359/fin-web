import type { ViewAction, ViewNode } from '../types/view'
import type { TableRow } from './hooks/use-table-sync'
import { omitServiceRowKeys } from './utils/service-row-keys'

export interface RestorableField {
  nodeId: string
  binding: string
  value: unknown
  isTable: boolean
}

function hasFieldEvent(node: ViewNode): boolean {
  return (
    node.actions?.some(
      (a) => a.trigger === 'change' && a.actionId === 'fieldEvent'
    ) === true
  )
}

function stableStringify(value: unknown): string {
  if (value === undefined || value === null) return 'null'
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}

export function sameValue(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}

export function collectRestorableFields(
  tree: ViewNode | null,
  clientState: Record<string, unknown>,
  serverState: Record<string, unknown>,
  skipNodeId?: string
): RestorableField[] {
  const result: RestorableField[] = []
  const seen = new Set<string>()
  const visit = (node: ViewNode) => {
    if (node.type === 'TABLE_COLUMN') return
    const binding = node.binding
    if (
      binding &&
      !seen.has(binding) &&
      node.id !== skipNodeId &&
      hasFieldEvent(node) &&
      node.props?.readonly !== true &&
      Object.prototype.hasOwnProperty.call(clientState, binding) &&
      !sameValue(clientState[binding], serverState[binding])
    ) {
      seen.add(binding)
      result.push({
        nodeId: node.id,
        binding,
        value: clientState[binding],
        isTable: node.type === 'TABLE',
      })
    }
    if (node.type === 'TABLE') return
    node.children?.forEach(visit)
  }
  if (tree) visit(tree)
  return result
}

export function restoreEventAction(field: RestorableField): ViewAction {
  if (field.isTable && Array.isArray(field.value)) {
    return {
      type: 'EVENT',
      sourceNodeId: field.nodeId,
      trigger: 'change',
      value: (field.value as TableRow[]).map(omitServiceRowKeys),
      fullSnapshot: true,
    }
  }
  return {
    type: 'EVENT',
    sourceNodeId: field.nodeId,
    trigger: 'change',
    value: field.value,
  }
}
