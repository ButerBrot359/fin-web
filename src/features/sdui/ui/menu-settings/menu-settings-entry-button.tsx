import { useState, type FC } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { figmaIcons } from '@/shared/ui/icons'

import { MenuSettingsDialog } from './menu-settings-dialog'

/**
 * Вход «по месту» в настройку меню (SCRUM-426 §4.1): кнопка внизу сайдбара,
 * доступна всем — обычный пользователь правит личный слой, обладатель права
 * получает в диалоге селектор уровня.
 */
export const MenuSettingsEntryButton: FC = () => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
        }}
        className="flex w-full items-center gap-2 border-0 bg-transparent px-4 py-2 text-left hover:bg-selection"
      >
        <span className="shrink-0">{figmaIcons['settings-2']}</span>
        <Typography variant="body2" className="truncate">
          {t('sdui.menuSettings.entryButton')}
        </Typography>
      </button>
      <MenuSettingsDialog
        open={open}
        onClose={() => {
          setOpen(false)
        }}
      />
    </>
  )
}
