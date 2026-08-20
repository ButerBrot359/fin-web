import type { FC } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

export interface ProductionYearChangeDialogProps {
  open: boolean
  targetYear: number | null
  busy: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

// Диалог SAVE_DISCARD_CANCEL_REQUIRED при смене года на грязном drafts (§5.4):
// «Сохранить» → общий save, затем god.open; «Не сохранять» → god.discard-and-open;
// «Отмена» — без запроса.
export const ProductionYearChangeDialog: FC<
  ProductionYearChangeDialogProps
> = ({ open, targetYear, busy, onSave, onDiscard, onCancel }) => {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="xs">
      <DialogTitle>{t('sdui.productionCalendar.yearDialogTitle')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          {t('sdui.productionCalendar.yearDialogMessage', {
            year: targetYear ?? '',
          })}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>
          {t('sdui.productionCalendar.cancel')}
        </Button>
        <Button onClick={onDiscard} disabled={busy}>
          {t('sdui.productionCalendar.discard')}
        </Button>
        <Button variant="contained" onClick={onSave} disabled={busy}>
          {t('sdui.productionCalendar.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
