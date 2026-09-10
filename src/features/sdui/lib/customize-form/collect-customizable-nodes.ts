import type { ViewNode } from '../../types/view'
import type { ViewSettingsPatchEntry } from '../../api/view-settings-api'

/** Строка диалога «Изменить форму»: нода, чью видимость можно настроить. */
export interface CustomizableNode {
  nodeId: string
  label: string
  /** Нода видима сейчас (в дереве уже учтён патч пользователя — его накладывает бэк). */
  visible: boolean
  /** Скрыта именно патчем пользователя — такую МОЖНО показать обратно. */
  hiddenByUser: boolean
}

/**
 * Ноды, которые диалог даёт скрывать/показывать: поля, группы, таблицы —
 * с подписью и стабильным id. Действия (кнопки, меню) не предлагаются:
 * их состав — вопрос команд и прав, не представления.
 */
const CUSTOMIZABLE_TYPES = new Set([
  'TEXT_FIELD',
  'TEXT_AREA',
  'NUMBER_FIELD',
  'DATE_FIELD',
  'DATETIME_FIELD',
  'CHECKBOX_FIELD',
  'ENUM_FIELD',
  'REFERENCE_FIELD',
  'OBJECT_FIELD',
  'GROUP',
  'TABLE',
])

/**
 * Собирает настраиваемые ноды дерева (конструктор дизайна Ф4).
 *
 * Скрытые СЕРВЕРОМ ноды (visible=false без записи в патче пользователя) не
 * попадают в список вовсе: раскрыть чужое скрытие нельзя — это могут быть
 * права (`visible:true` в патче сервер отвергает). Скрытые ПАТЧЕМ — в списке
 * с выключенной галочкой, их можно вернуть удалением записи из патча.
 */
export function collectCustomizableNodes(
  root: ViewNode | null,
  patch: ViewSettingsPatchEntry[]
): CustomizableNode[] {
  if (!root) return []
  const hiddenByPatch = new Set(
    patch
      .filter((entry) => entry.props.visible === false)
      .map((entry) => entry.nodeId)
  )
  const result: CustomizableNode[] = []
  walk(root, hiddenByPatch, result)
  return result
}

function walk(
  node: ViewNode,
  hiddenByPatch: Set<string>,
  out: CustomizableNode[]
): void {
  const label = node.props?.label
  const visible = node.props?.visible !== false
  const hiddenByUser = hiddenByPatch.has(node.id)
  if (
    CUSTOMIZABLE_TYPES.has(node.type) &&
    typeof label === 'string' &&
    label.trim() !== '' &&
    (visible || hiddenByUser)
  ) {
    out.push({ nodeId: node.id, label, visible, hiddenByUser })
  }
  for (const child of node.children ?? []) {
    walk(child, hiddenByPatch, out)
  }
}

/**
 * Собирает НОВЫЙ полный патч из решений диалога: записи чужих пропов
 * (ширина от агента и т.п.) сохраняются, `visible:false` ставится/снимается
 * по галочкам. Пустые записи выбрасываются — их и сервер бы отбросил.
 */
export function buildPatchFromDecisions(
  currentPatch: ViewSettingsPatchEntry[],
  hiddenNodeIds: Set<string>
): ViewSettingsPatchEntry[] {
  const byNodeId = new Map(
    currentPatch.map((entry) => [entry.nodeId, { ...entry.props }])
  )
  for (const [nodeId, props] of byNodeId) {
    if (!hiddenNodeIds.has(nodeId)) {
      delete props.visible
      if (Object.keys(props).length === 0) byNodeId.delete(nodeId)
    }
  }
  for (const nodeId of hiddenNodeIds) {
    const props = byNodeId.get(nodeId) ?? {}
    props.visible = false
    byNodeId.set(nodeId, props)
  }
  return [...byNodeId.entries()].map(([nodeId, props]) => ({ nodeId, props }))
}
