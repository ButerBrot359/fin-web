import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { cn } from '@/shared/lib/utils/cn'
import {
  isQuarterInPeriod,
  QUARTER_LABELS,
  quarterPeriod,
  type PeriodRange,
} from '@/shared/lib/utils/period-choice'

import { PeriodChoiceYearPager } from './period-choice-year-pager'

interface PeriodChoiceQuarterGridProps {
  startYear: number
  period: PeriodRange
  onStartYearChange: (year: number) => void
  onPick: (picked: PeriodRange) => void
  onApply: (picked: PeriodRange) => void
}

export const PeriodChoiceQuarterGrid: FC<PeriodChoiceQuarterGridProps> = ({
  startYear,
  period,
  onStartYearChange,
  onPick,
  onApply,
}) => {
  const { t } = useTranslation()

  return (
    <PeriodChoiceYearPager
      startYear={startYear}
      onStartYearChange={onStartYearChange}
      renderYear={(year) => (
        <>
          <Typography className="py-1 text-center text-body1 font-bold text-ui-06">
            {year}
          </Typography>
          {QUARTER_LABELS.map((label, quarter) => {
            const selected = isQuarterInPeriod(period, year, quarter)
            return (
              <button
                key={label}
                type="button"
                aria-pressed={selected}
                className={cn(
                  'cursor-pointer rounded-sm px-2 py-1 text-body2',
                  selected
                    ? 'bg-accent-01 text-ui-06'
                    : 'text-ui-06 hover:bg-ui-04'
                )}
                onClick={() => {
                  onPick(quarterPeriod(year, quarter))
                }}
                onDoubleClick={() => {
                  onApply(quarterPeriod(year, quarter))
                }}
              >
                {t('periodChoice.quarter', { quarter: label })}
              </button>
            )
          })}
        </>
      )}
    />
  )
}
