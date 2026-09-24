import type { FC, MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { Button } from '@/shared/ui/buttons'
import { figmaIcons } from '@/shared/ui/icons'
import { cn } from '@/shared/lib/utils/cn'

import {
  isMonthInPeriod,
  monthPeriod,
  quarterPeriod,
  yearPeriod,
  type PeriodRange,
} from '@/shared/lib/utils/period-choice'

const YEARS_SHOWN = 3
const QUARTERS = [0, 1, 2, 3]
const QUARTER_LABELS = ['I', 'II', 'III', 'IV']

interface PeriodChoiceMonthGridProps {
  startYear: number
  period: PeriodRange
  onStartYearChange: (year: number) => void
  onPick: (picked: PeriodRange, extend: boolean) => void
}

export const PeriodChoiceMonthGrid: FC<PeriodChoiceMonthGridProps> = ({
  startYear,
  period,
  onStartYearChange,
  onPick,
}) => {
  const { t } = useTranslation()
  const months: string[] = t('periodChoice.months', {
    returnObjects: true,
  })
  const years = Array.from({ length: YEARS_SHOWN }, (_, i) => startYear + i)

  const pick = (e: MouseEvent, picked: PeriodRange) => {
    onPick(picked, e.shiftKey)
  }

  return (
    <div className="flex items-start gap-2">
      <Button
        variant="tertiary"
        size="small"
        aria-label={t('periodChoice.previousYears')}
        startIcon={figmaIcons['arrow-left-small']}
        onClick={() => {
          onStartYearChange(startYear - 1)
        }}
      />
      <div className="flex flex-1 gap-6">
        {years.map((year) => (
          <div key={year} className="flex flex-1 flex-col gap-1">
            <button
              type="button"
              className="cursor-pointer rounded-sm py-1 text-center hover:bg-ui-04"
              onClick={(e) => {
                pick(e, yearPeriod(year))
              }}
            >
              <Typography className="text-body1 font-bold text-ui-06">
                {year}
              </Typography>
            </button>
            {QUARTERS.map((quarter) => (
              <div key={quarter} className="flex items-center gap-1">
                <button
                  type="button"
                  title={t('periodChoice.quarter', {
                    quarter: QUARTER_LABELS[quarter],
                  })}
                  className="w-8 cursor-pointer rounded-sm py-1 text-caption text-ui-05 hover:bg-ui-04"
                  onClick={(e) => {
                    pick(e, quarterPeriod(year, quarter))
                  }}
                >
                  {QUARTER_LABELS[quarter]}
                </button>
                {[0, 1, 2].map((offset) => {
                  const month = quarter * 3 + offset
                  const selected = isMonthInPeriod(period, year, month)
                  return (
                    <button
                      key={month}
                      type="button"
                      aria-pressed={selected}
                      className={cn(
                        'flex-1 cursor-pointer rounded-sm px-2 py-1 text-body2',
                        selected
                          ? 'bg-accent-01 text-ui-06'
                          : 'text-ui-06 hover:bg-ui-04'
                      )}
                      onClick={(e) => {
                        pick(e, monthPeriod(year, month))
                      }}
                    >
                      {months[month]}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
      <Button
        variant="tertiary"
        size="small"
        aria-label={t('periodChoice.nextYears')}
        startIcon={figmaIcons['arrow-right-small']}
        onClick={() => {
          onStartYearChange(startYear + 1)
        }}
      />
    </div>
  )
}
