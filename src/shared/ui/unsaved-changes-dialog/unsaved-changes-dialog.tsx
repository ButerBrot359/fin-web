import { Dialog } from '@mui/material'
import { useTranslation } from 'react-i18next'

import CrossIcon from '@/shared/assets/icons/cross.svg'
import { Button } from '@/shared/ui/buttons'

interface UnsavedChangesDialogProps {
  open: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export const UnsavedChangesDialog = ({
  open,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) => {
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
            {t('unsavedChangesDialog.title')}
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
          {t('unsavedChangesDialog.message')}
        </p>

        <div className="flex w-full gap-3">
          <Button
            variant="primary"
            onClick={onSave}
            className="flex-1 rounded-lg"
          >
            {t('unsavedChangesDialog.save')}
          </Button>
          <Button
            variant="secondary"
            onClick={onDiscard}
            className="flex-1 rounded-lg"
          >
            {t('unsavedChangesDialog.discard')}
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
