import type { FC } from 'react'
import { Dialog, Typography } from '@mui/material'

import CrossIcon from '@/shared/assets/icons/cross.svg'
import { Button } from '@/shared/ui/buttons'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

// Generic confirm-диалог с двумя действиями. Строки передаёт вызывающая
// сторона (уже переведённые) — компонент не привязан к i18n-ключам.
export const ConfirmDialog: FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}) => (
  <Dialog
    open={open}
    onClose={onCancel}
    slotProps={{
      paper: {
        sx: {
          borderRadius: '40px',
          boxShadow: '0px 3px 24px 0px rgba(42, 117, 244, 0.4)',
          p: 0,
          m: 0,
          minWidth: 660,
          maxWidth: 'none',
        },
      },
    }}
  >
    <div className="flex flex-col gap-8 px-15 py-10">
      <div className="flex w-full items-center gap-6">
        <Typography
          component="h2"
          className="flex-1 text-[26px] font-bold leading-normal text-ui-06"
        >
          {title}
        </Typography>
        <button type="button" onClick={onCancel} className="shrink-0 cursor-pointer">
          <CrossIcon className="h-5 w-5" />
        </button>
      </div>

      <Typography className="text-base font-medium text-ui-06">{message}</Typography>

      <div className="flex w-full gap-3">
        <Button variant="primary" onClick={onConfirm} className="flex-1 rounded-lg">
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel} className="flex-1 rounded-lg">
          {cancelLabel}
        </Button>
      </div>
    </div>
  </Dialog>
)
