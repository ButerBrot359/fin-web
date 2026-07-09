import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import UserIcon from '@/shared/assets/icons/user.svg'
import MenuIcon from '@/shared/assets/icons/menu.svg'
import { Button } from '@/shared/ui/buttons'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog/confirm-dialog'

import { TOOLBAR_ACTIONS } from '../lib/consts/toolbar-actions'
import { useLanguageSwitch } from '../lib/hooks/use-language-switch'

const LANGUAGE_LABELS: Record<string, string> = {
  ru: 'РУС',
  kz: 'ҚАЗ',
}

export const TopBar = () => {
  const { t, i18n } = useTranslation()
  const { confirmOpen, requestToggle, confirmSwitch, cancelSwitch } =
    useLanguageSwitch()

  return (
    <div className="flex justify-end">
      <nav className="flex items-center bg-ui-01 rounded-md">
        <div className="flex items-center">
          {TOOLBAR_ACTIONS.map((action, index) => (
            <div key={action.id} className="flex items-center">
              {index > 0 && (
                <div className="mx-1 h-5 w-px bg-ui-04" aria-hidden="true" />
              )}
              <Button
                variant="tertiary"
                aria-label={action.label}
                startIcon={<action.icon className="h-5 w-5" />}
              />
            </div>
          ))}
        </div>

        <div className="mx-1 h-5 w-px bg-ui-04" aria-hidden="true" />

        <Button
          variant="tertiary"
          aria-label="Switch language"
          onClick={requestToggle}
          className="px-2"
        >
          <Typography variant="body2" className="font-medium">
            {LANGUAGE_LABELS[i18n.language] ?? 'РУС'}
          </Typography>
        </Button>

        <div className="mx-1 h-5 w-px bg-ui-04" aria-hidden="true" />

        <div className="flex items-center gap-2 mx-1">
          <UserIcon className="h-5 w-5 text-ui-03" />
          <Typography variant="body2" className="text-ui-06">
            {t('topBar.userName')}
          </Typography>
        </div>

        <div className="mx-1 h-5 w-px bg-ui-04" aria-hidden="true" />

        <Button
          variant="tertiary"
          aria-label="Menu"
          startIcon={<MenuIcon className="h-5 w-5" />}
        />
      </nav>

      <ConfirmDialog
        open={confirmOpen}
        title={t('languageSwitchDialog.title')}
        message={t('languageSwitchDialog.message')}
        confirmLabel={t('languageSwitchDialog.confirm')}
        cancelLabel={t('actions.cancel')}
        onConfirm={confirmSwitch}
        onCancel={cancelSwitch}
      />
    </div>
  )
}
