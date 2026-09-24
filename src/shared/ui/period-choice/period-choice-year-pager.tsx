import type { FC, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'
import { figmaIcons } from '@/shared/ui/icons'

const YEARS_SHOWN = 3

interface PeriodChoiceYearPagerProps {
  startYear: number
  onStartYearChange: (year: number) => void
  renderYear: (year: number) => ReactNode
}

export const PeriodChoiceYearPager: FC<PeriodChoiceYearPagerProps> = ({
  startYear,
  onStartYearChange,
  renderYear,
}) => {
  const { t } = useTranslation()
  const years = Array.from({ length: YEARS_SHOWN }, (_, i) => startYear + i)

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
            {renderYear(year)}
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
