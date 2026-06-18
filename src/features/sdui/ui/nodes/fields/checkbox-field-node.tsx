import type { FC } from 'react'
import { Checkbox, FormControlLabel, FormHelperText, FormControl } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useSduiSession } from '../../../lib/sdui-session-context'
import { useSduiDispatch } from '../../../lib/dispatch'

export const CheckboxFieldNode: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const required = node.props?.required as boolean | undefined
  const readonly = node.props?.readonly as boolean | undefined
  const visible = (node.props?.visible as boolean | undefined) ?? true
  const enabled = (node.props?.enabled as boolean | undefined) ?? true
  const error = node.props?.error as string | undefined
  const flex = node.props?.flex as number | string | undefined

  const { getValue, setValue } = useSduiSession()
  const value = (getValue(node.binding) as boolean | undefined) ?? false
  const dispatch = useSduiDispatch()

  if (!visible) return null

  const fireServerEvent = (trigger: string, newValue: unknown) => {
    if (node.actions?.some((a) => a.trigger === trigger && a.actionId === 'fieldEvent')) {
      void dispatch({ type: 'EVENT', sourceNodeId: node.id, trigger, value: newValue })
    }
  }

  return (
    <FormControl
      error={!!error}
      required={required}
      sx={{ flex: flex !== undefined ? flex : undefined }}
    >
      <FormControlLabel
        label={label ?? ''}
        control={
          <Checkbox
            checked={value}
            disabled={!enabled || readonly}
            onChange={(e) => {
              const newVal = e.target.checked
              if (node.binding) setValue(node.binding, newVal)
              fireServerEvent('change', newVal)
            }}
          />
        }
      />
      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  )
}
