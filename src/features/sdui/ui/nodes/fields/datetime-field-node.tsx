import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { useFieldNode } from '../../../lib/hooks/use-field-node'
import { DateTimeInput } from '@/shared/ui/inputs'

export const DatetimeFieldNode: FC<NodeProps> = ({ node }) => {
  const f = useFieldNode(node)
  const value = (f.value as string | undefined) ?? ''

  if (!f.visible) return null

  return (
    <div style={{ flex: f.flex !== undefined ? f.flex : undefined }}>
      <DateTimeInput
        label={f.label}
        value={value}
        required={f.required}
        readOnly={f.readonly}
        disabled={!f.enabled}
        error={!!f.error}
        helperText={f.error}
        onChange={(newValue) => {
          f.setValue(newValue)
          f.fireServerEvent('change', newValue)
        }}
      />
    </div>
  )
}
