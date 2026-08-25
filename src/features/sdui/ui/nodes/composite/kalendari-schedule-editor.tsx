import { useState, type FC } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useTranslation } from 'react-i18next'

import type { TableRow as SyncRow } from '../../../lib/hooks/use-table-sync'
import { replaceDayRows } from './kalendari-schedule-rows'

interface KalendariScheduleEditorProps {
  open: boolean
  dayLabel: string
  dayNumber: number
  allRows: SyncRow[]
  onApply: (rows: SyncRow[]) => void
  onClose: () => void
}

const toTime = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  const match = /(?:T|^)(\d{2}:\d{2})(?::(\d{2})(\.\d+)?)?$/.exec(value)
  if (!match || (match[2] && (match[2] !== '00' || match[3]))) return ''
  return match[1]
}

const toWireTime = (value: string): string => `2000-01-01T${value}:00`

const timeToMinutes = (value: unknown): number | null => {
  const time = toTime(value)
  if (!/^\d{2}:\d{2}$/.test(time)) return null
  const [hours, minutes] = time.split(':').map(Number)
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

const draftForDay = (allRows: SyncRow[], dayNumber: number): SyncRow[] =>
  allRows
    .filter((row) => row.NomerDnya === dayNumber)
    .map((row) => ({
      ...row,
      VremyaNachala: toTime(row.VremyaNachala)
        ? toWireTime(toTime(row.VremyaNachala))
        : row.VremyaNachala,
      VremyaOkonchaniya: toTime(row.VremyaOkonchaniya)
        ? toWireTime(toTime(row.VremyaOkonchaniya))
        : row.VremyaOkonchaniya,
    }))

export const KalendariScheduleEditor: FC<KalendariScheduleEditorProps> = ({
  open,
  dayLabel,
  dayNumber,
  allRows,
  onApply,
  onClose,
}) => {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<SyncRow[]>(() =>
    draftForDay(allRows, dayNumber)
  )
  const [error, setError] = useState<string | null>(null)

  const resetDraft = () => {
    setDraft(draftForDay(allRows, dayNumber))
    setError(null)
  }

  const updateTime = (rowId: string, binding: string, value: string) => {
    setDraft((current) =>
      current.map((row) =>
        row.rowId === rowId ? { ...row, [binding]: toWireTime(value) } : row
      )
    )
  }

  const addInterval = () => {
    setDraft((current) => [
      ...current,
      {
        rowId: `tmp-${crypto.randomUUID()}`,
        NomerDnya: dayNumber,
        VremyaNachala: toWireTime('09:00'),
        VremyaOkonchaniya: toWireTime('18:00'),
      },
    ])
  }

  const removeInterval = (rowId: string) => {
    setDraft((current) => current.filter((row) => row.rowId !== rowId))
  }

  const apply = () => {
    const ordered = draft
      .map((row) => ({
        start: timeToMinutes(row.VremyaNachala),
        end: timeToMinutes(row.VremyaOkonchaniya),
      }))
      .sort((a, b) => (a.start ?? -1) - (b.start ?? -1))
    if (
      ordered.some(
        (interval) => interval.start === null || interval.end === null
      )
    ) {
      setError(t('sdui.kalendari.invalidTime'))
      return
    }
    if (ordered.some((interval) => interval.end! <= interval.start!)) {
      setError(t('sdui.kalendari.invalidInterval'))
      return
    }
    if (
      ordered.some(
        (interval, index) =>
          index > 0 && ordered[index - 1].end! > interval.start!
      )
    ) {
      setError(t('sdui.kalendari.overlappingIntervals'))
      return
    }
    onApply(replaceDayRows(allRows, dayNumber, draft))
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{ transition: { onEnter: resetDraft } }}
    >
      <DialogTitle>{`${t('sdui.kalendari.schedule')}: ${dayLabel}`}</DialogTitle>
      <DialogContent>
        {error && (
          <Typography sx={{ mb: 1 }} variant="body2" color="error">
            {error}
          </Typography>
        )}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('sdui.kalendari.start')}</TableCell>
              <TableCell>{t('sdui.kalendari.end')}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {draft.map((row) => (
              <TableRow key={row.rowId}>
                <TableCell>
                  <TextField
                    type="time"
                    size="small"
                    value={toTime(row.VremyaNachala)}
                    onChange={(event) => {
                      updateTime(row.rowId, 'VremyaNachala', event.target.value)
                    }}
                    slotProps={{ htmlInput: { step: 60 } }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    type="time"
                    size="small"
                    value={toTime(row.VremyaOkonchaniya)}
                    onChange={(event) => {
                      updateTime(
                        row.rowId,
                        'VremyaOkonchaniya',
                        event.target.value
                      )
                    }}
                    slotProps={{ htmlInput: { step: 60 } }}
                  />
                </TableCell>
                <TableCell padding="checkbox">
                  <IconButton
                    aria-label={t('sdui.kalendari.deleteInterval')}
                    onClick={() => {
                      removeInterval(row.rowId)
                    }}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button sx={{ mt: 2 }} onClick={addInterval}>
          {t('sdui.kalendari.addInterval')}
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sdui.kalendari.cancel')}</Button>
        <Button variant="contained" onClick={apply}>
          {t('sdui.kalendari.apply')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
