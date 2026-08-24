import { useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AddIcon from '@mui/icons-material/Add'
import {
  Alert,
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
} from '@mui/material'

import {
  formatWireTime,
  toWireTime,
  type ScheduleRow,
} from './kalendari-schedule-summary'
import {
  validateIntervals,
  type IntervalErrorKey,
} from './kalendari-schedule-validation'

interface DraftRow {
  /** rowId исходной строки RaspisanieRaboty; новые строки — tmp-* (spec v3). */
  rowId: string
  start: string
  end: string
}

interface KalendariScheduleEditorProps {
  /** NomerDnya редактируемого дня (1..7 — позиция в шаблоне). */
  day: number
  /** Подпись дня для заголовка («Пн» / «День 3»). */
  dayLabel: string
  /** ПОЛНЫЙ текущий массив RaspisanieRaboty — контракт full-table snapshot. */
  rows: ScheduleRow[]
  /** Полный новый массив: чужие дни (и день 0) нетронуты, свой день заменён. */
  onApply: (next: ScheduleRow[]) => void
  onClose: () => void
}

const minutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':')
  return Number(h) * 60 + Number(m)
}

/**
 * Модалка интервалов одного дня (spec v3). Владеет локальным черновиком:
 * Отмена/бэкдроп родителя не меняют; Apply валидирует и отдаёт наверх полный
 * массив таблицы. Персист — существующий «Записать» карточки.
 */
export const KalendariScheduleEditor: FC<KalendariScheduleEditorProps> = ({
  day,
  dayLabel,
  rows,
  onApply,
  onClose,
}) => {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<DraftRow[]>(() =>
    rows
      .filter((r) => r.NomerDnya === day)
      .map((r) => ({
        rowId: r.rowId,
        start: formatWireTime(r.VremyaNachala) ?? '',
        end: formatWireTime(r.VremyaOkonchaniya) ?? '',
      }))
  )
  const [error, setError] = useState<IntervalErrorKey | null>(null)

  const patchDraft = (index: number, patch: Partial<DraftRow>) => {
    setDraft((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...patch } : d))
    )
  }

  const addInterval = () => {
    setDraft((prev) => [
      ...prev,
      { rowId: `tmp-${crypto.randomUUID()}`, start: '', end: '' },
    ])
  }

  const deleteInterval = (index: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== index))
  }

  const handleApply = () => {
    const err = validateIntervals(draft)
    if (err) {
      setError(err)
      return
    }
    const dayRows: ScheduleRow[] = [...draft]
      .sort((a, b) => minutes(a.start) - minutes(b.start))
      .map((d) => ({
        rowId: d.rowId,
        NomerDnya: day,
        VremyaNachala: toWireTime(d.start),
        VremyaOkonchaniya: toWireTime(d.end),
      }))
    onApply([...rows.filter((r) => r.NomerDnya !== day), ...dayRows])
  }

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {t('sdui.kalendari.workTimeTitle', { label: dayLabel })}
      </DialogTitle>
      <DialogContent>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('sdui.kalendari.start')}</TableCell>
              <TableCell>{t('sdui.kalendari.end')}</TableCell>
              <TableCell padding="checkbox" />
            </TableRow>
          </TableHead>
          <TableBody>
            {draft.map((d, index) => (
              <TableRow key={d.rowId}>
                <TableCell>
                  <TextField
                    type="time"
                    size="small"
                    value={d.start}
                    onChange={(e) => {
                      patchDraft(index, { start: e.target.value })
                    }}
                    slotProps={{
                      htmlInput: { 'aria-label': t('sdui.kalendari.start') },
                    }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    type="time"
                    size="small"
                    value={d.end}
                    onChange={(e) => {
                      patchDraft(index, { end: e.target.value })
                    }}
                    slotProps={{
                      htmlInput: { 'aria-label': t('sdui.kalendari.end') },
                    }}
                  />
                </TableCell>
                <TableCell padding="checkbox">
                  <IconButton
                    size="small"
                    aria-label={t('sdui.kalendari.deleteInterval')}
                    onClick={() => {
                      deleteInterval(index)
                    }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={addInterval}
          sx={{ mt: 1 }}
        >
          {t('sdui.kalendari.addInterval')}
        </Button>
        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {t(error)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sdui.kalendari.cancel')}</Button>
        <Button variant="contained" onClick={handleApply}>
          {t('sdui.kalendari.apply')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
