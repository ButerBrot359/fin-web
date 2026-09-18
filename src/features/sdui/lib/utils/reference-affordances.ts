import type { ViewNode, ViewNodeAction } from '../../types/view'

/**
 * Аффордансы ссылочного поля (SCRUM-291 §18.3): пары «серверная команда +
 * флаг allow*» для showAll/create/open/copy.
 *
 * <p>props.allow* — единственный источник видимости аффордансов. Асимметрия
 * дефолтов не случайна и повторяет серверную (ReferenceAffordanceResolver):
 * allowShowAll открыт, пока явно не false; остальные три закрыты, пока явно
 * не true. Дефолты применяет ПОТРЕБИТЕЛЬ (формулы видимости различаются по
 * месту) — здесь только механическое чтение узла.
 */
export interface ReferenceAffordance {
  /** Серверная команда (`actionId: 'command'`) с соответствующим trigger. */
  action: ViewNodeAction | undefined
  /** Сырое значение props.allow* — без применения дефолта. */
  allow: boolean | undefined
}

export interface ReferenceAffordances {
  showAll: ReferenceAffordance
  create: ReferenceAffordance
  open: ReferenceAffordance
  copy: ReferenceAffordance
}

function readAffordance(
  node: ViewNode,
  trigger: string,
  allowProp: string
): ReferenceAffordance {
  return {
    action: node.actions?.find(
      (a) => a.trigger === trigger && a.actionId === 'command'
    ),
    allow: node.props?.[allowProp] as boolean | undefined,
  }
}

export function readReferenceAffordances(node: ViewNode): ReferenceAffordances {
  return {
    showAll: readAffordance(node, 'showAll', 'allowShowAll'),
    create: readAffordance(node, 'create', 'allowCreate'),
    open: readAffordance(node, 'open', 'allowOpen'),
    copy: readAffordance(node, 'copy', 'allowCopy'),
  }
}
