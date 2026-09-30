import type { FC } from 'react'
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import type { EnumOption } from '../../../lib/utils/enum-value'
import { useFieldNode } from '../../../lib/hooks/use-field-node'

function toNumber(raw: unknown): number | null {
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw !== ''
        ? parseFloat(raw)
        : NaN
  return Number.isFinite(n) ? n : null
}

export const NumberChoiceField: FC<NodeProps> = ({ node }) => {
  const f = useFieldNode(node)
  const options = (node.props?.options as EnumOption[] | undefined) ?? []

  if (!f.visible) return null

  const current = toNumber(f.value)
  const matched =
    current === null
      ? undefined
      : options.find((o) => toNumber(o.value) === current)
  const items =
    current !== null && !matched
      ? [...options, { value: String(current), label: String(current) }]
      : options
  const selected = current === null ? '' : (matched?.value ?? String(current))
  const labelId = `number-choice-${node.id}-label`

  return (
    <FormControl
      fullWidth
      variant="filled"
      error={!!f.error}
      required={f.required}
      disabled={!f.enabled}
    >
      {f.label && <InputLabel id={labelId}>{f.label}</InputLabel>}
      <Select
        labelId={f.label ? labelId : undefined}
        label={f.label}
        value={selected}
        readOnly={f.readonly}
        IconComponent={f.readonly ? () => null : undefined}
        onChange={(e) => {
          const next = toNumber(e.target.value)
          if (next === null || next === current) return
          f.setValue(next)
          f.fireServerEvent('change', next)
        }}
      >
        {items.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}
