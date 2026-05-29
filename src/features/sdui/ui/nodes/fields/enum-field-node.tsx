import type { FC } from 'react'
import {
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useViewState, useViewStateSetter } from '../../../lib/stores/view-state-store'
import { useSduiDispatch } from '../../../lib/dispatch'

interface EnumOption {
  value: string
  label: string
}

export const EnumFieldNode: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const required = node.props?.required as boolean | undefined
  const readonly = node.props?.readonly as boolean | undefined
  const visible = (node.props?.visible as boolean | undefined) ?? true
  const enabled = (node.props?.enabled as boolean | undefined) ?? true
  const error = node.props?.error as string | undefined
  const flex = node.props?.flex as number | string | undefined
  const options = (node.props?.options as EnumOption[] | undefined) ?? []

  const value = (useViewState(node.binding) as string | undefined) ?? ''
  const setValue = useViewStateSetter()
  const dispatch = useSduiDispatch()

  if (!visible) return null

  const fireServerEvent = (trigger: string, newValue: unknown) => {
    if (node.actions?.some((a) => a.trigger === trigger && a.actionId === 'fieldEvent')) {
      void dispatch({ type: 'EVENT', sourceNodeId: node.id, trigger, value: newValue })
    }
  }

  const labelId = `enum-field-${node.id}-label`

  return (
    <FormControl
      error={!!error}
      required={required}
      disabled={!enabled}
      sx={{ flex: flex !== undefined ? flex : undefined }}
    >
      {label && <InputLabel id={labelId}>{label}</InputLabel>}
      <Select
        labelId={label ? labelId : undefined}
        label={label}
        value={value}
        readOnly={readonly}
        onChange={(e) => {
          const newVal = e.target.value
          if (node.binding) setValue(node.binding, newVal)
          fireServerEvent('change', newVal)
        }}
      >
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  )
}
