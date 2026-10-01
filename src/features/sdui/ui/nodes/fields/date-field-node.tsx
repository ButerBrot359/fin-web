import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { useFieldNode } from '../../../lib/hooks/use-field-node'
import { DateTimeInput } from '@/shared/ui/inputs'
import { readPeriodChoice } from '../../../lib/utils/period-choice-props'
import { PeriodChoiceNodeButton } from './period-choice/period-choice-button'

export const DateFieldNode: FC<NodeProps> = ({ node }) => {
  const f = useFieldNode(node)
  const value = (f.value as string | undefined) ?? ''

  if (!f.visible) return null

  const periodChoice = readPeriodChoice(node.props?.periodChoice)

  const input = (
    <DateTimeInput
      label={f.label}
      value={value}
      size={node.props?.size as 'small' | undefined}
      dateOnly={true}
      dateFormat={node.props?.dateFormat as string | undefined}
      required={f.required}
      readOnly={f.readonly}
      disabled={!f.enabled}
      // SCRUM-317 v4 §4.1: текст ошибки живёт в панели и тултипе — под полем только рамка
      error={!!f.error}
      onChange={(newValue) => {
        f.setValue(newValue)
        f.fireServerEvent('change', newValue)
      }}
    />
  )

  if (!periodChoice) return <div>{input}</div>

  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">{input}</div>
      <PeriodChoiceNodeButton
        choice={periodChoice}
        disabled={f.readonly === true || !f.enabled}
      />
    </div>
  )
}
