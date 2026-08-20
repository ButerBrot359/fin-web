import type { FC } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import type {
  ProductionCalendarPrintIndicators,
  ProductionCalendarPrintPeriod,
  ProductionCalendarPrintProjection,
} from '../../../../lib/calendar/production-calendar-command-results'
import { monthLabel } from '../../../../lib/calendar/calendar-format'

export interface ProductionPrintPreviewProps {
  projection: ProductionCalendarPrintProjection
  onClose: () => void
}

const INDICATOR_KEYS = [
  'calendarDays',
  'workingDays',
  'daysOff',
  'hours40',
  'hours36',
  'hours24',
] as const

const IndicatorCells: FC<{ ind: ProductionCalendarPrintIndicators }> = ({
  ind,
}) => (
  <>
    {INDICATOR_KEYS.map((k) => (
      <TableCell key={k} align="right">
        {ind[k]}
      </TableCell>
    ))}
  </>
)

// Печатная проекция норм рабочего времени (§7): фронт ТОЛЬКО отображает
// готовые серверные числа — 4 квартала с месяцами, итоги кварталов,
// полугодий после II/IV, год после IV, среднемесячный блок.
export const ProductionPrintPreview: FC<ProductionPrintPreviewProps> = ({
  projection,
  onClose,
}) => {
  const { t } = useTranslation()
  const pc = 'sdui.productionCalendar'

  const periodRow = (
    label: string,
    p: ProductionCalendarPrintPeriod,
    bold = false
  ) => (
    <TableRow key={label}>
      <TableCell sx={bold ? { fontWeight: 600 } : undefined}>{label}</TableCell>
      <IndicatorCells ind={p.indicators} />
    </TableRow>
  )

  const quarterBlock = (quarterNumber: number) => {
    const quarter = projection.quarters.find((q) => q.number === quarterNumber)
    const months = projection.months.filter(
      (m) => Math.ceil(m.number / 3) === quarterNumber
    )
    const halfYear =
      quarterNumber % 2 === 0
        ? projection.halfYears.find((h) => h.number === quarterNumber / 2)
        : undefined
    const annual = quarterNumber === 4 ? projection.annual : undefined

    return (
      <Table key={quarterNumber} size="small" className="mb-4">
        <TableHead>
          <TableRow>
            <TableCell>
              {t(`${pc}.quarter`, { number: quarterNumber })}
            </TableCell>
            <TableCell align="right">{t(`${pc}.calendarDays`)}</TableCell>
            <TableCell align="right">{t(`${pc}.workingDays`)}</TableCell>
            <TableCell align="right">{t(`${pc}.daysOff`)}</TableCell>
            <TableCell align="right">{t(`${pc}.hours40`)}</TableCell>
            <TableCell align="right">{t(`${pc}.hours36`)}</TableCell>
            <TableCell align="right">{t(`${pc}.hours24`)}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {months.map((m) =>
            periodRow(monthLabel(projection.calendarYear, m.number - 1), m)
          )}
          {quarter &&
            periodRow(
              t(`${pc}.quarterTotal`, { number: quarterNumber }),
              quarter,
              true
            )}
          {halfYear &&
            periodRow(
              t(`${pc}.halfYearTotal`, { number: halfYear.number }),
              halfYear,
              true
            )}
          {annual &&
            periodRow(
              t(`${pc}.annualTotal`, { year: projection.calendarYear }),
              { number: 0, indicators: annual },
              true
            )}
        </TableBody>
      </Table>
    )
  }

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t(`${pc}.printTitle`, { year: projection.calendarYear })}
      </DialogTitle>
      <DialogContent>
        {[1, 2, 3, 4].map(quarterBlock)}
        <Typography variant="subtitle2" className="mb-1">
          {t(`${pc}.averageMonthly`)}
        </Typography>
        <Typography variant="body2">
          {t(`${pc}.hours40`)}: {projection.averageMonthly.hours40} ·{' '}
          {t(`${pc}.hours36`)}: {projection.averageMonthly.hours36} ·{' '}
          {t(`${pc}.hours24`)}: {projection.averageMonthly.hours24}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          {t(`${pc}.close`)}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
