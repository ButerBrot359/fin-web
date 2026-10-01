import { useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'
import { figmaIcons } from '@/shared/ui/icons'
import {
  normalizePeriod,
  type PeriodRange,
} from '@/shared/lib/utils/period-choice'

import { PeriodChoiceDialog } from './period-choice-dialog'

interface PeriodChoiceButtonProps {
  period: PeriodRange
  quarterOnly?: boolean
  onChange: (period: PeriodRange) => void
  disabled?: boolean
}

export const PeriodChoiceButton: FC<PeriodChoiceButtonProps> = ({
  period,
  quarterOnly,
  onChange,
  disabled,
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="secondary"
        className="h-11 w-11 shrink-0 border border-ui-03"
        disabled={disabled}
        title={t('periodChoice.title')}
        aria-label={t('periodChoice.title')}
        startIcon={figmaIcons['set-period']}
        onClick={() => {
          setOpen(true)
        }}
      />
      {open && (
        <PeriodChoiceDialog
          initial={normalizePeriod(period)}
          quarterOnly={quarterOnly}
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
