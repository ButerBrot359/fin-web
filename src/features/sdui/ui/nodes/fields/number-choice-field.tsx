import { useState, type FC } from 'react'
import { Autocomplete, TextField } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import type { EnumOption } from '../../../lib/utils/enum-value'
import { useFieldNode } from '../../../lib/hooks/use-field-node'

function toNumber(raw: unknown): number | null {
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw.trim().replace(',', '.'))
        : NaN
  return Number.isFinite(n) ? n : null
}

function display(n: number | null): string {
  return n === null ? '' : String(n)
}

export const NumberChoiceField: FC<NodeProps> = ({ node }) => {
  const f = useFieldNode(node)
  const options = (node.props?.options as EnumOption[] | undefined) ?? []
  const current = toNumber(f.value)
  const [draft, setDraft] = useState<string | null>(null)
  const input = draft ?? display(current)

  if (!f.visible) return null

  const commit = (text: string) => {
    setDraft(null)
    const next = toNumber(text)
    if (next === null && text.trim() !== '') return
    if (next === current) return
    f.setValue(next)
    f.fireServerEvent('change', next)
  }

  return (
    <Autocomplete
      freeSolo
      disableClearable
      fullWidth
      options={options.map((o) => o.value)}
      getOptionLabel={(v) => options.find((o) => o.value === v)?.label ?? v}
      filterOptions={(all) => all}
      value={display(current)}
      inputValue={input}
      readOnly={f.readonly}
      disabled={!f.enabled}
      onInputChange={(_, text, reason) => {
        if (reason === 'input') setDraft(text)
      }}
      onChange={(_, v) => {
        commit(typeof v === 'string' ? v : '')
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={f.label}
          size={node.props?.size as 'small' | undefined}
          required={f.required}
          error={!!f.error}
          onBlur={() => {
            commit(input)
          }}
          slotProps={{
            htmlInput: { ...params.inputProps, inputMode: 'decimal' },
          }}
        />
      )}
    />
  )
}
