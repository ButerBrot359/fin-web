import type { FC } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { MenuScope } from '../../api/menu-settings-api'
import { MenuSettingsEditor } from './menu-settings-editor'

interface MenuSettingsDialogProps {
  open: boolean
  onClose: () => void
  initialScope?: MenuScope
}

/**
 * Диалог «Настроить меню» (SCRUM-426 §4.1, вход «по месту» у сайдбара):
 * тот же редактор, что на админ-странице, по умолчанию — личный слой.
 */
export const MenuSettingsDialog: FC<MenuSettingsDialogProps> = ({
  open,
  onClose,
  initialScope,
}) => {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('sdui.menuSettings.title')}</DialogTitle>
      <DialogContent className="flex min-h-96 flex-col">
        {open && (
          <MenuSettingsEditor initialScope={initialScope} onSaved={onClose} />
        )}
      </DialogContent>
    </Dialog>
  )
}
