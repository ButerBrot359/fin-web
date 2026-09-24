import { useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'
import {
  normalizePeriod,
  type PeriodRange,
} from '@/shared/lib/utils/period-choice'

import { PeriodChoiceDialog } from './period-choice-dialog'

interface PeriodChoiceButtonProps {
  period: PeriodRange
  onChange: (period: PeriodRange) => void
  disabled?: boolean
}

export const PeriodChoiceButton: FC<PeriodChoiceButtonProps> = ({
  period,
  onChange,
  disabled,
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="secondary"
        className="h-12"
        disabled={disabled}
        title={t('periodChoice.title')}
        aria-label={t('periodChoice.title')}
        onClick={() => {
          setOpen(true)
        }}
      >
        {t('periodChoice.button')}
      </Button>
      {open && (
        <PeriodChoiceDialog
          initial={normalizePeriod(period)}
          onSelect={(next) => {
            setOpen(false)
            onChange(normalizePeriod(next))
          }}
          onClose={() => {
            setOpen(false)
          }}
        />
      )}
    </>
  )
}
