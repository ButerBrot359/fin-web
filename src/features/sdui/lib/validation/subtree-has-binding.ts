import type { ViewNode } from '../../types/view'

/**
 * Есть ли в поддереве узел с данным binding (включая колонки ТЧ — адрес
 * TABLE_CELL несёт columnCode, но искать вкладку достаточно по tableCode,
 * а FIELD — по коду реквизита).
 */
export function subtreeHasBinding(node: ViewNode, binding: string): boolean {
  if (node.binding === binding) return true
  if (!node.children) return false
  return node.children.some((child) => subtreeHasBinding(child, binding))
}
