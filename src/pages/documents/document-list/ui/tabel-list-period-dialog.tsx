import { useState } from 'react'
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { FilterCondition } from '@/shared/lib/eav'
import { Button } from '@/shared/ui/buttons'
import { DateTimeInput } from '@/shared/ui/inputs'

import {
  TABEL_LIST_PERIOD_FIELD,
  toTabelListPeriodCondition,
  type ListPeriod,
} from '../lib/tabel-list-period'

const periodFromCondition = (
  condition: FilterCondition | undefined
): ListPeriod => {
  if (condition?.field !== TABEL_LIST_PERIOD_FIELD) {
    return { from: '', to: '' }
  }
  if (condition.op === 'between' && Array.isArray(condition.value)) {
    return {
      from: typeof condition.value[0] === 'string' ? condition.value[0] : '',
      to: typeof condition.value[1] === 'string' ? condition.value[1] : '',
    }
  }
  if (condition.op === 'gte' && typeof condition.value === 'string') {
    return { from: condition.value, to: '' }
  }
  if (condition.op === 'lte' && typeof condition.value === 'string') {
    return { from: '', to: condition.value }
  }
  return { from: '', to: '' }
}

interface TabelListPeriodDialogProps {
  open: boolean
  currentCondition?: FilterCondition
  onApply: (condition: FilterCondition | null) => void
  onClose: () => void
}

const TabelListPeriodDialogContents = ({
  currentCondition,
  onApply,
  onClose,
}: Omit<TabelListPeriodDialogProps, 'open'>) => {
  const { t } = useTranslation()
  const initial = periodFromCondition(currentCondition)
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [invalidRange, setInvalidRange] = useState(false)

  const apply = () => {
    if (from && to && from > to) {
      setInvalidRange(true)
      return
    }
    onApply(toTabelListPeriodCondition({ from, to }))
  }

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onClose}>
      <DialogTitle>{t('documentListToolbar.selectPeriod')}</DialogTitle>
      <DialogContent>
        <div className="flex gap-3 pt-2">
          <DateTimeInput
            dateOnly
            fullWidth
            label={t('table.periodFrom')}
            value={from}
            error={invalidRange}
            onChange={(value) => {
              setFrom(value)
              setInvalidRange(false)
            }}
          />
          <DateTimeInput
            dateOnly
            fullWidth
            label={t('table.periodTo')}
            value={to}
            error={invalidRange}
            helperText={
              invalidRange ? t('documentListToolbar.invalidPeriod') : undefined
            }
            onChange={(value) => {
              setTo(value)
              setInvalidRange(false)
            }}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          variant="secondary"
          onClick={() => {
            onApply(null)
          }}
        >
          {t('actions.clear')}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {t('actions.cancel')}
        </Button>
        <Button variant="primary" onClick={apply}>
          {t('actions.select')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export const TabelListPeriodDialog = (props: TabelListPeriodDialogProps) =>
  props.open ? <TabelListPeriodDialogContents {...props} /> : null
