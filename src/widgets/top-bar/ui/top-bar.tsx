import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import UserIcon from '@/shared/assets/icons/user.svg'
import MenuIcon from '@/shared/assets/icons/menu.svg'

import { TOOLBAR_ACTIONS } from '../lib/consts/toolbar-actions'

export const TopBar = () => {
  const { t } = useTranslation()

  return (
    <div className="flex justify-end">
      <nav className="flex items-center bg-ui-01 rounded-md">
        <div className="flex items-center">
          {TOOLBAR_ACTIONS.map((action, index) => (
            <div key={action.id} className="flex items-center">
              {index > 0 && (
                <div className="mx-1 h-5 w-px bg-ui-04" aria-hidden="true" />
              )}
              <button
                type="button"
                aria-label={action.label}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-ui-03 transition-colors hover:text-ui-01"
              >
                <action.icon className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>

        <div className="mx-1 h-5 w-px bg-ui-04" aria-hidden="true" />

        <div className="flex items-center gap-2">
          <UserIcon className="h-5 w-5 text-ui-03" />
          <Typography variant="body2" className="text-ui-06">
            {t('topBar.userName')}
          </Typography>
        </div>

        <div className="mx-1 h-5 w-px bg-ui-04" aria-hidden="true" />

        <button
          type="button"
          aria-label="Menu"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-ui-03 transition-colors hover:text-ui-01"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
      </nav>
    </div>
  )
}
