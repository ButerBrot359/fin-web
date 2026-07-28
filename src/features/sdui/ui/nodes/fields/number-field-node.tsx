import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { useFieldNode } from '../../../lib/hooks/use-field-node'
import { useChangeOnBlur } from '../../../lib/hooks/use-change-on-blur'
import { NumberInput } from '@/shared/ui/inputs'

export const NumberFieldNode: FC<NodeProps> = ({ node }) => {
  const f = useFieldNode(node)
  const precision = (node.props?.precision as number | undefined) ?? 0
  const rawValue = f.value as number | string | null | undefined
  const changeOnBlur = useChangeOnBlur(f, rawValue)

  if (!f.visible) return null

  const stringValue =
    rawValue === null || rawValue === undefined ? '' : String(rawValue)

  return (
    <NumberInput
      label={f.label}
      value={stringValue}
      required={f.required}
      readOnly={f.readonly}
      disabled={!f.enabled}
      error={!!f.error}
      helperText={f.error}
      decimal={precision > 0}
      onChange={(e) => {
        const raw = e.target.value
        const parsed = raw === '' ? null : parseFloat(raw)
        f.setValue(parsed)
      }}
      onFocus={changeOnBlur.onFocus}
      onBlur={changeOnBlur.onBlur}
      sx={{ flex: f.flex !== undefined ? f.flex : undefined }}
    />
  )
}
