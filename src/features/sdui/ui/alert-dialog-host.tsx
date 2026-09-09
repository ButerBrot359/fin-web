import { useTranslation } from 'react-i18next'
import { Dialog, Typography } from '@mui/material'

import CrossIcon from '@/shared/assets/icons/cross.svg'
import { Button } from '@/shared/ui/buttons'
import { cssVar, shadows } from '@/shared/design/tokens'

import { useAlertStore } from '../lib/stores/alert-store'

/**
 * Хост модального предупреждения (SCRUM-317 §4.2, эффект alert). Одна кнопка —
 * пользователь подтверждает прочтение; уровня и ветвления у предупреждения нет.
 */
export const AlertDialogHost = () => {
  const { t } = useTranslation()
  const open = useAlertStore((s) => s.open)
  const message = useAlertStore((s) => s.message)
  const title = useAlertStore((s) => s.title)
  const close = useAlertStore((s) => s.close)

  return (
    <Dialog
      open={open}
      onClose={close}
      slotProps={{
        paper: {
          sx: {
            borderRadius: '40px',
            boxShadow: cssVar(shadows.popup),
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
            {title ?? t('sdui.alert.title')}
          </Typography>
          <button
            type="button"
            onClick={close}
            className="shrink-0 cursor-pointer"
          >
            <CrossIcon className="h-5 w-5" />
          </button>
        </div>

        <Typography className="text-base font-medium text-ui-06">
          {message}
        </Typography>

        <div className="flex w-full gap-3">
          <Button
            variant="primary"
            onClick={close}
            className="flex-1 rounded-lg"
          >
            {t('sdui.alert.ok')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
