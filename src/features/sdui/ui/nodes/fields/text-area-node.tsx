import type { FC } from 'react'
import { TextField } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useSduiSession } from '../../../lib/sdui-session-context'
import { useSduiDispatch } from '../../../lib/dispatch'

export const TextAreaNode: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const required = node.props?.required as boolean | undefined
  const readonly = node.props?.readonly as boolean | undefined
  const visible = (node.props?.visible as boolean | undefined) ?? true
  const enabled = (node.props?.enabled as boolean | undefined) ?? true
  const error = node.props?.error as string | undefined
  const flex = node.props?.flex as number | string | undefined
  const placeholder = node.props?.placeholder as string | undefined
  const maxLength = node.props?.maxLength as number | undefined
  const rows = (node.props?.rows as number | undefined) ?? 3

  const { getValue, setValue } = useSduiSession()
  const value = (getValue(node.binding) as string | undefined) ?? ''
  const dispatch = useSduiDispatch()

  if (!visible) return null

  const fireServerEvent = (trigger: string, newValue: unknown) => {
    if (node.actions?.some((a) => a.trigger === trigger && a.actionId === 'fieldEvent')) {
      void dispatch({ type: 'EVENT', sourceNodeId: node.id, trigger, value: newValue })
    }
  }

  return (
    <TextField
      label={label}
      value={value}
      placeholder={placeholder}
      required={required}
      error={!!error}
      helperText={error}
      disabled={!enabled}
      multiline
      rows={rows}
      onChange={(e) => {
        if (node.binding) setValue(node.binding, e.target.value)
      }}
      onBlur={() => {
        fireServerEvent('change', value)
      }}
      sx={{ flex: flex !== undefined ? flex : undefined }}
      slotProps={{
        input: { readOnly: readonly },
        htmlInput: maxLength !== undefined ? { maxLength } : undefined,
      }}
    />
  )
}
