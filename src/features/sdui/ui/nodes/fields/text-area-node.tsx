import type { FC } from 'react'
import { TextField } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useFieldNode } from '../../../lib/hooks/use-field-node'

export const TextAreaNode: FC<NodeProps> = ({ node }) => {
  const f = useFieldNode(node)
  const placeholder = node.props?.placeholder as string | undefined
  const maxLength = node.props?.maxLength as number | undefined
  const rows = (node.props?.rows as number | undefined) ?? 3
  const value = (f.value as string | undefined) ?? ''

  if (!f.visible) return null

  return (
    <TextField
      label={f.label}
      value={value}
      placeholder={placeholder}
      required={f.required}
      error={!!f.error}
      helperText={f.error}
      disabled={!f.enabled}
      multiline
      rows={rows}
      onChange={(e) => f.setValue(e.target.value)}
      onBlur={() => f.fireServerEvent('change', value)}
      sx={{ flex: f.flex !== undefined ? f.flex : undefined }}
      slotProps={{
        input: { readOnly: f.readonly },
        htmlInput: maxLength !== undefined ? { maxLength } : undefined,
      }}
    />
  )
}
