import type { ViewNode } from '../../types/view'
import type { ViewSettingsPatchEntry } from '../../api/view-settings-api'
import { FIELD_NODE_TYPES } from '../utils/field-node-types'

/** Строка диалога «Изменить форму»: нода, чьё представление можно настроить. */
export interface CustomizableNode {
  nodeId: string
  label: string
  /** Нода видима сейчас (в дереве уже учтён патч пользователя — его накладывает бэк). */
  visible: boolean
  /** Скрыта именно патчем пользователя — такую МОЖНО показать обратно. */
  hiddenByUser: boolean
  /** id родителя — порядок меняется только среди соседей одного родителя. */
  parentId: string
  /** Индекс среди ВСЕХ детей родителя (включая ненастраиваемые) — база для order. */
  childIndex: number
  /** Поле ввода: для него доступна настройка ширины. */
  isField: boolean
  /** Текущая ширина из патча/дерева, px; undefined — авто. */
  width: number | undefined
}

/** Решение диалога по одной ноде; отсутствующий ключ = «не трогать» (кроме hidden/width). */
export interface NodeDecision {
  hidden: boolean
  /** px; undefined — авто (проп снимается). */
  width?: number
  /** Позиция среди детей родителя; undefined — порядок этой сессией не менялся. */
  order?: number
}

const CONTAINER_TYPES = new Set(['GROUP', 'TABLE'])

/**
 * Собирает настраиваемые ноды дерева (конструктор дизайна Ф4): поля, группы,
 * таблицы — с подписью и стабильным id. Действия (кнопки, меню) не предлагаются:
 * их состав — вопрос команд и прав, не представления.
 *
 * Скрытые СЕРВЕРОМ ноды (visible=false без записи в патче пользователя) не
 * попадают в список вовсе: раскрыть чужое скрытие нельзя (`visible:true`
 * сервер отвергает — это могут быть права). Скрытые ПАТЧЕМ — в списке с
 * выключенной галочкой.
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
  parent: ViewNode,
  hiddenByPatch: Set<string>,
  out: CustomizableNode[]
): void {
  const children = parent.children ?? []
  children.forEach((node, childIndex) => {
    const label = node.props?.label
    const visible = node.props?.visible !== false
    const hiddenByUser = hiddenByPatch.has(node.id)
    const isField = FIELD_NODE_TYPES.has(node.type)
    if (
      (isField || CONTAINER_TYPES.has(node.type)) &&
      typeof label === 'string' &&
      label.trim() !== '' &&
      (visible || hiddenByUser)
    ) {
      const width = node.props?.width
      out.push({
        nodeId: node.id,
        label,
        visible,
        hiddenByUser,
        parentId: parent.id,
        childIndex,
        isField,
        width: typeof width === 'number' && width > 0 ? width : undefined,
      })
    }
    walk(node, hiddenByPatch, out)
  })
}

/**
 * Собирает НОВЫЙ полный патч из решений диалога поверх текущего: записи и
 * пропы, которых решения не касаются (например, `gap`, выставленный агентом,
 * или прошлый `order` нетронутого родителя), сохраняются как есть. Пустые
 * записи выбрасываются — их и сервер бы отбросил.
 */
export function buildPatchFromDecisions(
  currentPatch: ViewSettingsPatchEntry[],
  decisions: Map<string, NodeDecision>
): ViewSettingsPatchEntry[] {
  const byNodeId = new Map(
    currentPatch.map((entry) => [entry.nodeId, { ...entry.props }])
  )
  for (const [nodeId, decision] of decisions) {
    const props = byNodeId.get(nodeId) ?? {}
    if (decision.hidden) props.visible = false
    else delete props.visible
    if (decision.width !== undefined) props.width = decision.width
    else delete props.width
    if (decision.order !== undefined) props.order = decision.order
    byNodeId.set(nodeId, props)
  }
  for (const [nodeId, props] of byNodeId) {
    if (Object.keys(props).length === 0) byNodeId.delete(nodeId)
  }
  return [...byNodeId.entries()].map(([nodeId, props]) => ({ nodeId, props }))
}

/**
 * Раздаёт `order` рядам ПЕРЕСТАВЛЕННЫХ родителей: новая расстановка группы
 * занимает те же индексные «слоты», что группа занимала исходно, — соседи вне
 * диалога (спейсеры, безымянные ноды) остаются на своих местах. Нетронутые
 * родители не получают order вовсе (их прежний order — если был — переживает
 * сохранение нетронутым в buildPatchFromDecisions).
 */
export function assignOrders(
  originalRows: CustomizableNode[],
  arrangedRows: CustomizableNode[],
  decisions: Map<string, NodeDecision>
): void {
  const parents = new Set(arrangedRows.map((r) => r.parentId))
  for (const parentId of parents) {
    const original = originalRows.filter((r) => r.parentId === parentId)
    const arranged = arrangedRows.filter((r) => r.parentId === parentId)
    const unchanged = original.every(
      (row, i) => arranged[i]?.nodeId === row.nodeId
    )
    if (unchanged) continue
    const slots = original.map((r) => r.childIndex).sort((a, b) => a - b)
    arranged.forEach((row, i) => {
      const decision = decisions.get(row.nodeId)
      if (decision) decision.order = slots[i]
    })
  }
}
