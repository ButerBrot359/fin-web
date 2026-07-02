import type { ViewNode } from '../../types/view'
import { useSduiDispatch } from '../dispatch'
import { useSduiSession, useBindingValue } from '../sdui-session-context'

export interface FieldNodeCommon {
  label?: string
  required?: boolean
  readonly?: boolean
  visible: boolean
  enabled: boolean
  error?: string
  flex?: number | string
  value: unknown
  setValue: (v: unknown) => void
  fireServerEvent: (trigger: string, newValue: unknown) => void
}

export function useFieldNode(node: ViewNode): FieldNodeCommon {
  const { setValue } = useSduiSession()
  const dispatch = useSduiDispatch()
  // Точечная подписка: нода ре-рендерится только при изменении своего значения (фикс M1).
  const value = useBindingValue(node.binding)

  return {
    label: node.props?.label as string | undefined,
    required: node.props?.required as boolean | undefined,
    readonly: node.props?.readonly as boolean | undefined,
    visible: (node.props?.visible as boolean | undefined) ?? true,
    enabled: (node.props?.enabled as boolean | undefined) ?? true,
    error: node.props?.error as string | undefined,
    flex: node.props?.flex as number | string | undefined,
    value,
    setValue: (v) => {
      if (node.binding) setValue(node.binding, v)
    },
    fireServerEvent: (trigger, newValue) => {
      if (node.actions?.some((a) => a.trigger === trigger && a.actionId === 'fieldEvent')) {
        void dispatch({ type: 'EVENT', sourceNodeId: node.id, trigger, value: newValue })
      }
    },
  }
}
