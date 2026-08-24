import type { FC } from 'react'
import {
  Checkbox,
  FormControlLabel,
  FormHelperText,
  FormControl,
} from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useFieldNode } from '../../../lib/hooks/use-field-node'
import { fieldBoxStyle } from '../../../lib/utils/field-box-style'

export const CheckboxFieldNode: FC<NodeProps> = ({ node }) => {
  const f = useFieldNode(node)
  const value = (f.value as boolean | undefined) ?? false

  if (!f.visible) return null

  return (
    <FormControl error={!!f.error} required={f.required} sx={fieldBoxStyle(f)}>
      <FormControlLabel
        label={f.label ?? ''}
        control={
          <Checkbox
            checked={value}
            disabled={!f.enabled || f.readonly}
            onChange={(e) => {
              const newVal = e.target.checked
              f.setValue(newVal)
              f.fireServerEvent('change', newVal)
            }}
          />
        }
      />
      {f.error && <FormHelperText>{f.error}</FormHelperText>}
    </FormControl>
  )
}
