import { useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'

import { useSduiDispatch } from '../../../../lib/dispatch'
import {
  useBindingValue,
  useSduiSession,
} from '../../../../lib/sdui-session-context'
import {
  normalizePeriod,
  type PeriodChoiceProps,
  type PeriodRange,
} from '../../../../lib/utils/period-choice'
import { PeriodChoiceDialog } from './period-choice-dialog'

interface PeriodChoiceButtonProps {
  choice: PeriodChoiceProps
  disabled?: boolean
}

export const PeriodChoiceButton: FC<PeriodChoiceButtonProps> = ({
  choice,
  disabled,
}) => {
  const { t } = useTranslation()
  const { setValue } = useSduiSession()
  const dispatch = useSduiDispatch()
  const from = useBindingValue(choice.fromNodeId) as string | undefined
  const to = useBindingValue(choice.toNodeId) as string | undefined
  const [open, setOpen] = useState(false)

  const apply = (period: PeriodRange) => {
    const next = normalizePeriod(period)
    setOpen(false)
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
    <>
      <Button
        variant="secondary"
        className="h-12"
        disabled={disabled}
        title={t('sdui.periodChoice.title')}
        aria-label={t('sdui.periodChoice.title')}
        onClick={() => {
          setOpen(true)
        }}
      >
        {t('sdui.periodChoice.button')}
      </Button>
      {open && (
        <PeriodChoiceDialog
          initial={normalizePeriod({ from: from ?? '', to: to ?? '' })}
          onSelect={apply}
          onClose={() => {
            setOpen(false)
          }}
        />
      )}
    </>
  )
}
