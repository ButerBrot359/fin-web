import type { ViewNode } from '../../types/view'

/**
 * Доступна ли команда хотя бы на одном узле дерева (SCRUM-400 §5.5):
 * программные пути (Ctrl+S) обязаны уважать то же гашение, что и кнопки.
 * Кнопка и её зеркало в «Ещё» несут одну команду — команда недоступна, только
 * когда погашены ВСЕ её носители (одна живая кнопка значит «можно»).
 */
export function isCommandUnavailable(
  tree: ViewNode | null,
  command: string
): boolean {
  if (!tree) return false
  let total = 0
  let disabled = 0
  const walk = (node: ViewNode): void => {
    if (node.props?.command === command) {
      total += 1
      if (node.props.enabled === false || node.props.disabled === true) {
        disabled += 1
      }
    }
    node.children?.forEach(walk)
  }
  walk(tree)
  return total > 0 && total === disabled
}
