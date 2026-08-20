import { useState, type FC } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import { DateTimeInput } from '@/shared/ui/inputs'

import type { CalendarDayKindDay } from '../../../../lib/calendar/calendar-types'

export interface ProductionTransferDialogProps {
  open: boolean
  sourceDay: CalendarDayKindDay | null
  calendarYear: number
  busy: boolean
  onConfirm: (firstDate: string, secondDate: string) => void
  onClose: () => void
}

// Диалог переноса дня (§13.6): ровно одна source-дата, назначение — в том же
// году и не равно источнику. Смену видов местами выполняет бэк.
export const ProductionTransferDialog: FC<ProductionTransferDialogProps> = ({
  open,
  sourceDay,
  calendarYear,
  busy,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation()
  const [destination, setDestination] = useState('')

  const sameYear = destination.startsWith(`${String(calendarYear)}-`)
  const validDestination =
    destination !== '' && sameYear && destination !== sourceDay?.date
  const error =
    destination !== '' && !validDestination
      ? t('sdui.productionCalendar.transferInvalidDate', {
          year: calendarYear,
        })
      : undefined

  const handleConfirm = () => {
    if (sourceDay && validDestination) onConfirm(sourceDay.date, destination)
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>{t('sdui.productionCalendar.transferTitle')}</DialogTitle>
      <DialogContent className="flex flex-col gap-3">
        <Typography variant="body2">
          {t('sdui.productionCalendar.transferSource')}: {sourceDay?.date}
          {sourceDay?.kindTitle ? ` (${sourceDay.kindTitle})` : ''}
        </Typography>
        <DateTimeInput
          label={t('sdui.productionCalendar.transferDestination')}
          value={destination}
          dateOnly={true}
          error={!!error}
          helperText={error}
          onChange={setDestination}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('sdui.productionCalendar.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={busy || !validDestination}
        >
          {t('sdui.productionCalendar.transferConfirm')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
