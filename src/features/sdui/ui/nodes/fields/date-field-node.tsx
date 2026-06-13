import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { useViewState, useViewStateSetter } from '../../../lib/stores/view-state-store'
import { useSduiDispatch } from '../../../lib/dispatch'
import { DateTimeInput } from '@/shared/ui/inputs'

export const DateFieldNode: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const required = node.props?.required as boolean | undefined
  const readonly = node.props?.readonly as boolean | undefined
  const visible = (node.props?.visible as boolean | undefined) ?? true
  const enabled = (node.props?.enabled as boolean | undefined) ?? true
  const error = node.props?.error as string | undefined
  const flex = node.props?.flex as number | string | undefined

  const value = (useViewState(node.binding) as string | undefined) ?? ''
  const setValue = useViewStateSetter()
  const dispatch = useSduiDispatch()

  if (!visible) return null

  const fireServerEvent = (trigger: string, newValue: unknown) => {
    if (node.actions?.some((a) => a.trigger === trigger && a.actionId === 'fieldEvent')) {
      void dispatch({ type: 'EVENT', sourceNodeId: node.id, trigger, value: newValue })
    }
  }

  return (
    <div style={{ flex: flex !== undefined ? flex : undefined }}>
      <DateTimeInput
        label={label}
        value={value}
        dateOnly={true}
        required={required}
        readOnly={readonly}
        disabled={!enabled}
        error={!!error}
        helperText={error}
        onChange={(newValue) => {
          if (node.binding) setValue(node.binding, newValue)
          fireServerEvent('change', newValue)
        }}
      />
    </div>
  )
}
