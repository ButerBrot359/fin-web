import type { ViewNode, ViewNodeAction } from '../../types/view'

export function findStartChoiceAction(
  node: ViewNode
): ViewNodeAction | undefined {
  return node.actions?.find(
    (a) =>
      a.trigger === 'startChoice' && a.actionId === 'command' && !!a.command
  )
}
