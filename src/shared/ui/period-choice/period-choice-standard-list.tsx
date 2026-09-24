import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/utils/cn'

import {
  STANDARD_PERIODS,
  standardPeriod,
  type PeriodRange,
} from '@/shared/lib/utils/period-choice'

interface PeriodChoiceStandardListProps {
  period: PeriodRange
  onPick: (picked: PeriodRange) => void
  onApply: (picked: PeriodRange) => void
}

export const PeriodChoiceStandardList: FC<PeriodChoiceStandardListProps> = ({
  period,
  onPick,
  onApply,
}) => {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-3 gap-1">
      {STANDARD_PERIODS.map((code) => {
        const range = standardPeriod(code)
        const selected = range.from === period.from && range.to === period.to
        return (
          <button
            key={code}
            type="button"
            aria-pressed={selected}
            className={cn(
              'cursor-pointer rounded-sm px-2 py-1 text-left text-body2',
              selected ? 'bg-accent-01 text-ui-06' : 'text-ui-06 hover:bg-ui-04'
            )}
            onClick={() => {
              onPick(range)
            }}
            onDoubleClick={() => {
              onApply(range)
            }}
          >
            {t(`periodChoice.standard.${code}`)}
          </button>
        )
      })}
    </div>
  )
}
