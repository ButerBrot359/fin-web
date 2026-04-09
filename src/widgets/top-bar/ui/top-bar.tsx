import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import UserIcon from '@/shared/assets/icons/user.svg'
import MenuIcon from '@/shared/assets/icons/menu.svg'

import { TOOLBAR_ACTIONS } from '../lib/consts/toolbar-actions'

const LANGUAGE_LABELS: Record<string, string> = {
  ru: 'РУС',
  kz: 'ҚАЗ',
}

export const TopBar = () => {
  const { t, i18n } = useTranslation()

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'ru' ? 'kz' : 'ru'
    void i18n.changeLanguage(nextLang)
  }

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
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-ui-06 transition-all hover:bg-ui-04 hover:text-accent-02 hover:shadow-md active:bg-ui-03 active:shadow-none"
              >
                <action.icon className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>

        <div className="mx-1 h-5 w-px bg-ui-04" aria-hidden="true" />

        <button
          type="button"
          aria-label="Switch language"
          onClick={toggleLanguage}
          className="flex h-10 cursor-pointer items-center justify-center rounded-lg px-2 text-black transition-all hover:bg-ui-04 hover:text-accent-02 hover:shadow-md active:bg-ui-03 active:shadow-none"
        >
          <Typography variant="body2" className="font-medium">
            {LANGUAGE_LABELS[i18n.language] ?? 'РУС'}
          </Typography>
        </button>

        <div className="mx-1 h-5 w-px bg-ui-04" aria-hidden="true" />

        <div className="flex items-center gap-2 mx-1">
          <UserIcon className="h-5 w-5 text-ui-03" />
          <Typography variant="body2" className="text-ui-06">
            {t('topBar.userName')}
          </Typography>
        </div>

        <div className="mx-1 h-5 w-px bg-ui-04" aria-hidden="true" />

        <button
          type="button"
          aria-label="Menu"
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-ui-06 transition-all hover:bg-ui-04 hover:text-accent-02 hover:shadow-md active:bg-ui-03 active:shadow-none"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
      </nav>
    </div>
  )
}
