import { useTranslation } from 'react-i18next'
import { Button, Dialog, DialogActions, DialogContent, Typography } from '@mui/material'

import { useConfirmStore } from '../lib/stores/confirm-store'

/** Хост диалога подтверждения для императивного моста confirm-store (SCRUM-244). */
export const ConfirmDialogHost = () => {
  const { t } = useTranslation()
  const open = useConfirmStore((s) => s.open)
  const message = useConfirmStore((s) => s.message)
  const answer = useConfirmStore((s) => s.answer)

  return (
    <Dialog open={open} onClose={() => { answer(false); }} maxWidth="xs" fullWidth>
      <DialogContent>
        <Typography>{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={() => { answer(false); }}>
          {t('sdui.confirm.cancel')}
        </Button>
        <Button variant="contained" onClick={() => { answer(true); }}>
          {t('sdui.confirm.ok')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
