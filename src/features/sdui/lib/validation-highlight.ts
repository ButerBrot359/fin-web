import type { ValidationErrorDetail, ViewNode, ViewPatch } from '../types/view'

export const DOCUMENT_VALIDATION_CODE = 'DOCUMENT_VALIDATION'

export function findNodeIdByBinding(
  root: ViewNode | null,
  binding: string
): string | null {
  if (!root) return null
  if (root.binding === binding) return root.id
  if (!root.children) return null
  for (const child of root.children) {
    if (child.type === 'TABLE_COLUMN') continue
    const found = findNodeIdByBinding(child, binding)
    if (found) return found
  }
  return null
}

export function buildValidationErrorPatches(
  root: ViewNode | null,
  errors: ValidationErrorDetail[] | undefined
): ViewPatch[] {
  if (!root || !errors?.length) return []
  const patches: ViewPatch[] = []
  const marked = new Set<string>()
  for (const e of errors) {
    const code = e.attributeCode
    if (code == null || code === '') continue
    const message = e.message
    if (!message) continue
    const nodeId = findNodeIdByBinding(root, code)
    if (!nodeId || marked.has(nodeId)) continue
    marked.add(nodeId)
    patches.push({ op: 'setProp', nodeId, key: 'error', value: message })
  }
  return patches
}
