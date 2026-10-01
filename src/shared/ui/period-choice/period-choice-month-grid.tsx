import { useEffect, useRef, type FC, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { cn } from '@/shared/lib/utils/cn'

import {
  isMonthInPeriod,
  monthPeriod,
  monthSpanPeriod,
  QUARTER_LABELS,
  quarterPeriod,
  yearPeriod,
  type PeriodRange,
} from '@/shared/lib/utils/period-choice'

import { PeriodChoiceYearPager } from './period-choice-year-pager'

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
  const pick = (e: MouseEvent, picked: PeriodRange) => {
    onPick(picked, e.shiftKey)
  }
  const dragAnchor = useRef<number | null>(null)

  useEffect(() => {
    const stopDrag = () => {
      dragAnchor.current = null
    }
    document.addEventListener('mouseup', stopDrag)
    return () => {
      document.removeEventListener('mouseup', stopDrag)
    }
  }, [])

  const startMonthDrag = (e: MouseEvent, index: number) => {
    if (e.button !== 0) return
    e.preventDefault()
    if (!e.shiftKey) dragAnchor.current = index
    pick(e, monthSpanPeriod(index, index))
  }

  const extendMonthDrag = (index: number) => {
    if (dragAnchor.current === null) return
    onPick(monthSpanPeriod(dragAnchor.current, index), false)
  }

  return (
    <PeriodChoiceYearPager
      startYear={startYear}
      onStartYearChange={onStartYearChange}
      renderYear={(year) => (
        <>
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
          {QUARTER_LABELS.map((label, quarter) => (
            <div key={quarter} className="flex items-center gap-1">
              <button
                type="button"
                title={t('periodChoice.quarter', {
                  quarter: label,
                })}
                className="w-8 cursor-pointer rounded-sm py-1 text-caption text-ui-05 hover:bg-ui-04"
                onClick={(e) => {
                  pick(e, quarterPeriod(year, quarter))
                }}
              >
                {label}
              </button>
              {[0, 1, 2].map((offset) => {
                const month = quarter * 3 + offset
                const index = year * 12 + month
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
                    onMouseDown={(e) => {
                      startMonthDrag(e, index)
                    }}
                    onMouseEnter={() => {
                      extendMonthDrag(index)
                    }}
                    onClick={(e) => {
                      if (e.detail === 0) pick(e, monthPeriod(year, month))
                    }}
                  >
                    {months[month]}
                  </button>
                )
              })}
            </div>
          ))}
        </>
      )}
    />
  )
}
