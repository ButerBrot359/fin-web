import type { FC } from 'react'
import { TextField } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useFieldNode } from '../../../lib/hooks/use-field-node'
import { useChangeOnBlur } from '../../../lib/hooks/use-change-on-blur'
import { useEditConfirm } from '../../../lib/hooks/use-edit-confirm'

export const TextFieldNode: FC<NodeProps> = ({ node }) => {
  const f = useFieldNode(node)
  const placeholder = node.props?.placeholder as string | undefined
  const maxLength = node.props?.maxLength as number | undefined
  const value = (f.value as string | undefined) ?? ''
  const changeOnBlur = useChangeOnBlur(f, value)
  const editConfirm = useEditConfirm(
    f.readonly ? undefined : (node.props?.editConfirm as string | undefined)
  )

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
      onChange={(e) => {
        f.setValue(e.target.value)
      }}
      onFocus={(e) => {
        changeOnBlur.onFocus()
        editConfirm.onFocus(e)
      }}
      onBlur={changeOnBlur.onBlur}
      slotProps={{
        input: { readOnly: f.readonly },
        htmlInput: maxLength !== undefined ? { maxLength } : undefined,
      }}
    />
  )
}
