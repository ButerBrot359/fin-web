import type { ViewNode } from '../../types/view'
import { useSduiDispatch } from '../dispatch'
import { useSduiSession, useBindingValue } from '../sdui-session-context'
import { notifyFieldEdited } from '../validation/field-edit-bus'

export interface FieldNodeCommon {
  label?: string
  required?: boolean
  readonly?: boolean
  visible: boolean
  enabled: boolean
  error?: string
  value: unknown
  /**
   * SCRUM-317 v4 §4.4: обычный вызов — правка пользователем, уведомляет шину
   * field-edit-bus (панель вычёркивает строку поля). Эффекты, программно
   * перезаписывающие значение, обязаны звать тихий вариант
   * `setValue(v, { silent: true })` — иначе строка панели исчезнет без
   * участия пользователя.
   */
  setValue: (v: unknown, options?: { silent?: boolean }) => void
  fireServerEvent: (trigger: string, newValue: unknown) => void
}

export function useFieldNode(node: ViewNode): FieldNodeCommon {
  const { setValue, applyTreePatches } = useSduiSession()
  const dispatch = useSduiDispatch()
  // Точечная подписка: нода ре-рендерится только при изменении своего значения (фикс M1).
  const value = useBindingValue(node.binding)

  return {
    label: node.props?.label as string | undefined,
    required: node.props?.required as boolean | undefined,
    readonly: node.props?.readonly as boolean | undefined,
    // SCRUM-362 B-4: бэк проставляет разрешающие дефолты явно на всех трёх
    // носителях узлов (tree/patches/effects) — отсутствие ключа больше не
    // означает «включено», а неотличимо от забытой эмиссии.
    visible: node.props?.visible === true,
    enabled: node.props?.enabled === true,
    error: node.props?.error as string | undefined,
    // props.flex виджету не отдаём: за раскладку в строке отвечает контейнер.
    // HSTACK уже оборачивает каждого ребёнка в <div style={{flex}}> (hstack-node),
    // а повторное применение того же flex внутри этой обёртки читается уже как
    // ВЫСОТА — обёртка колоночная, и flex-basis в ней вертикальный. Строковый
    // basis вида "0 1 240px" давал полосу пустоты на 240px под контролом.
    value,
    setValue: (v, options) => {
      if (node.props?.error != null) {
        applyTreePatches([
          { op: 'setProp', nodeId: node.id, key: 'error', value: null },
        ])
      }
      if (node.binding && options?.silent !== true) {
        notifyFieldEdited(node.binding)
      }
      if (node.binding) setValue(node.binding, v)
    },
    fireServerEvent: (trigger, newValue) => {
      if (
        node.actions?.some(
          (a) => a.trigger === trigger && a.actionId === 'fieldEvent'
        )
      ) {
        void dispatch({
          type: 'EVENT',
          sourceNodeId: node.id,
          trigger,
          value: newValue,
        })
      }
    },
  }
}
