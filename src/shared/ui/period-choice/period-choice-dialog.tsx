import { useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, Typography } from '@mui/material'

import CrossIcon from '@/shared/assets/icons/cross.svg'
import { Button } from '@/shared/ui/buttons'
import { DateTimeInput } from '@/shared/ui/inputs'
import { cssVar, shadows } from '@/shared/design/tokens'

import {
  EMPTY_PERIOD,
  initialStartYear,
  unionPeriod,
  type PeriodRange,
} from '@/shared/lib/utils/period-choice'
import { PeriodChoiceMonthGrid } from './period-choice-month-grid'
import { PeriodChoiceStandardList } from './period-choice-standard-list'

interface PeriodChoiceDialogProps {
  initial: PeriodRange
  onSelect: (period: PeriodRange) => void
  onClose: () => void
}

export const PeriodChoiceDialog: FC<PeriodChoiceDialogProps> = ({
  initial,
  onSelect,
  onClose,
}) => {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<PeriodRange>(initial)
  const [startYear, setStartYear] = useState(() => initialStartYear(initial))
  const [standardMode, setStandardMode] = useState(false)

  const pickFromGrid = (picked: PeriodRange, extend: boolean) => {
    setDraft(extend ? unionPeriod(draft, picked) : picked)
  }

  return (
    <Dialog
      open
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            borderRadius: '24px',
            boxShadow: cssVar(shadows.popup),
            p: 0,
            m: 0,
            minWidth: 720,
            maxWidth: 'none',
          },
        },
      }}
    >
      <div className="flex flex-col gap-4 px-8 py-6">
        <div className="flex w-full items-center gap-4">
          <Typography
            component="h2"
            className="flex-1 text-xl font-bold text-ui-06"
          >
            {t('periodChoice.title')}
          </Typography>
          <button
            type="button"
            aria-label={t('periodChoice.cancel')}
            onClick={onClose}
            className="shrink-0 cursor-pointer"
          >
            <CrossIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-44">
            <DateTimeInput
              dateOnly
              value={draft.from}
              label={t('periodChoice.from')}
              onChange={(from) => {
                setDraft({ ...draft, from })
              }}
            />
          </div>
          <Typography className="text-body2 text-ui-05">—</Typography>
          <div className="w-44">
            <DateTimeInput
              dateOnly
              value={draft.to}
              label={t('periodChoice.to')}
              onChange={(to) => {
                setDraft({ ...draft, to })
              }}
            />
          </div>
          <Button
            variant="tertiary"
            size="small"
            onClick={() => {
              setDraft(EMPTY_PERIOD)
            }}
          >
            {t('periodChoice.clear')}
          </Button>
        </div>

        {standardMode ? (
          <PeriodChoiceStandardList
            period={draft}
            onPick={setDraft}
            onApply={onSelect}
          />
        ) : (
          <PeriodChoiceMonthGrid
            startYear={startYear}
            period={draft}
            onStartYearChange={setStartYear}
            onPick={pickFromGrid}
          />
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="tertiary"
            size="small"
            onClick={() => {
              setStandardMode(!standardMode)
            }}
          >
            {standardMode
              ? t('periodChoice.showCalendar')
              : t('periodChoice.showStandard')}
          </Button>
          <div className="flex-1" />
          <Button
            variant="primary"
            onClick={() => {
              onSelect(draft)
            }}
          >
            {t('periodChoice.select')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('periodChoice.cancel')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
