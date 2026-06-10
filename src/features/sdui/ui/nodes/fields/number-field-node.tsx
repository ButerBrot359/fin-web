import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { useViewState, useViewStateSetter } from '../../../lib/stores/view-state-store'
import { useSduiDispatch } from '../../../lib/dispatch'
import { NumberInput } from '@/shared/ui/inputs'

export const NumberFieldNode: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const required = node.props?.required as boolean | undefined
  const readonly = node.props?.readonly as boolean | undefined
  const visible = (node.props?.visible as boolean | undefined) ?? true
  const enabled = (node.props?.enabled as boolean | undefined) ?? true
  const error = node.props?.error as string | undefined
  const flex = node.props?.flex as number | string | undefined
  const precision = (node.props?.precision as number | undefined) ?? 0

  const rawValue = useViewState(node.binding) as number | string | null | undefined
  const setValue = useViewStateSetter()
  const dispatch = useSduiDispatch()

  if (!visible) return null

  const fireServerEvent = (trigger: string, newValue: unknown) => {
    if (node.actions?.some((a) => a.trigger === trigger && a.actionId === 'fieldEvent')) {
      void dispatch({ type: 'EVENT', sourceNodeId: node.id, trigger, value: newValue })
    }
  }

  const stringValue =
    rawValue === null || rawValue === undefined ? '' : String(rawValue)

  return (
    <NumberInput
      label={label}
      value={stringValue}
      required={required}
      readOnly={readonly}
      disabled={!enabled}
      error={!!error}
      helperText={error}
      decimal={precision > 0}
      onChange={(e) => {
        if (node.binding) {
          const raw = e.target.value
          const parsed = raw === '' ? null : parseFloat(raw)
          setValue(node.binding, parsed)
        }
      }}
      onBlur={() => {
        fireServerEvent('change', rawValue)
      }}
      sx={{ flex: flex !== undefined ? flex : undefined }}
    />
  )
}
