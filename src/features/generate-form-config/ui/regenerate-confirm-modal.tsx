import { Dialog } from '@mui/material'
import { useTranslation } from 'react-i18next'

import CrossIcon from '@/shared/assets/icons/cross.svg'
import { Button } from '@/shared/ui/buttons'

interface RegenerateConfirmModalProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const RegenerateConfirmModal = ({
  open,
  onConfirm,
  onCancel,
}: RegenerateConfirmModalProps) => {
  const { t } = useTranslation()

  return (
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
          <h2 className="flex-1 text-[26px] font-bold leading-normal text-ui-06">
            {t('aiConfig.title')}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 cursor-pointer"
          >
            <CrossIcon className="h-5 w-5" />
          </button>
        </div>

        <p className="text-base font-medium text-ui-06">
          {t('aiConfig.regenerateMessage')}
        </p>

        <div className="flex w-full gap-3">
          <Button
            variant="primary"
            onClick={onConfirm}
            className="flex-1 rounded-lg"
          >
            {t('aiConfig.regenerate')}
          </Button>
          <Button
            variant="secondary"
            onClick={onCancel}
            className="flex-1 rounded-lg"
          >
            {t('actions.cancel')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
