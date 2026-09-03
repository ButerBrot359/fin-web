import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { useFieldNode } from '../../../lib/hooks/use-field-node'
import { DateTimeInput } from '@/shared/ui/inputs'

export const DatetimeFieldNode: FC<NodeProps> = ({ node }) => {
  const f = useFieldNode(node)
  const value = (f.value as string | undefined) ?? ''

  if (!f.visible) return null

  return (
    <div>
      <DateTimeInput
        label={f.label}
        value={value}
        // Маска месяца («Период: Сентябрь 2026» у Разделения результатов расчёта
        // зарплаты) приходит с бэка одним props.dateFormat — тем же ключом, что уже
        // читает поле DATE. Без проброса DATETIME-поле игнорировало формат и
        // показывало полную дату со временем.
        dateFormat={node.props?.dateFormat as string | undefined}
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
