import type { FC } from 'react'
import {
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useFieldNode } from '../../../lib/hooks/use-field-node'

interface EnumOption {
  value: string
  label: string
  id?: number
  code?: string
}

export const EnumFieldNode: FC<NodeProps> = ({ node }) => {
  const f = useFieldNode(node)
  const options = (node.props?.options as EnumOption[] | undefined) ?? []
  const value = (f.value as string | undefined) ?? ''

  if (!f.visible) return null

  const labelId = `enum-field-${node.id}-label`

  return (
    <FormControl
      error={!!f.error}
      required={f.required}
      disabled={!f.enabled}
      sx={{ flex: f.flex !== undefined ? f.flex : undefined }}
    >
      {f.label && <InputLabel id={labelId}>{f.label}</InputLabel>}
      <Select
        labelId={f.label ? labelId : undefined}
        label={f.label}
        value={value}
        readOnly={f.readonly}
        onChange={(e) => {
          const selectedValue = e.target.value
          f.setValue(selectedValue)
          const opt = options.find((o) => o.value === selectedValue)
          const enumValue = opt
            ? { id: opt.id ?? selectedValue, code: opt.code ?? opt.value, presentation: opt.label }
            : { id: selectedValue, code: selectedValue, presentation: selectedValue }
          f.fireServerEvent('change', enumValue)
        }}
      >
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
      {f.error && <FormHelperText>{f.error}</FormHelperText>}
    </FormControl>
  )
}
