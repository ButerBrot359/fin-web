import type { ActionBehavior, ViewNode } from '../../types/view'

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

/**
 * resetsDirty команды — из её узла в дереве (SCRUM-400 §5.9): behavior —
 * единственный серверный источник «пишущести»; когда диспатч пришёл без него
 * (Ctrl+S, программный вызов), восстанавливаем по узлу-носителю команды.
 */
export function findCommandResetsDirty(
  tree: ViewNode | null,
  command: string
): boolean {
  if (!tree) return false
  let found = false
  const walk = (node: ViewNode): void => {
    if (found) return
    if (node.props?.command === command) {
      const behavior =
        (node.props.behavior as ActionBehavior | undefined) ??
        node.actions?.find((a) => a.trigger === 'click')?.behavior
      if (behavior?.resetsDirty === true) found = true
    }
    node.children?.forEach(walk)
  }
  walk(tree)
  return found
}
