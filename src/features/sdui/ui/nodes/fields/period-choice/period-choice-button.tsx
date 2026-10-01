import type { FC } from 'react'

import { PeriodChoiceButton } from '@/shared/ui/period-choice'
import type { PeriodRange } from '@/shared/lib/utils/period-choice'

import { useSduiDispatch } from '../../../../lib/dispatch'
import {
  useBindingValue,
  useSduiSession,
} from '../../../../lib/sdui-session-context'
import type { PeriodChoiceProps } from '../../../../lib/utils/period-choice-props'

interface PeriodChoiceNodeButtonProps {
  choice: PeriodChoiceProps
  disabled?: boolean
}

export const PeriodChoiceNodeButton: FC<PeriodChoiceNodeButtonProps> = ({
  choice,
  disabled,
}) => {
  const { setValue } = useSduiSession()
  const dispatch = useSduiDispatch()
  const from = useBindingValue(choice.fromNodeId) as string | undefined
  const to = useBindingValue(choice.toNodeId) as string | undefined

  const apply = (next: PeriodRange) => {
    setValue(choice.fromNodeId, next.from)
    setValue(choice.toNodeId, next.to)
    void dispatch({
      type: 'EVENT',
      sourceNodeId: choice.sourceNodeId,
      trigger: 'change',
      value: { from: next.from || null, to: next.to || null },
    })
  }

  return (
    <PeriodChoiceButton
      period={{ from: from ?? '', to: to ?? '' }}
      quarterOnly={choice.quarterOnly}
      onChange={apply}
      disabled={disabled}
    />
  )
}
