import type { FC } from 'react'
import { Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { menuSettingsApi, MenuSettingsEditor } from '@/features/sdui'

/**
 * Админ-страница «Настройка меню» (SCRUM-426 §4.1): пункт модуля Администрирование
 * (раздел «Безопасность», route /admin/menu-settings). Редактор общий с диалогом
 * «Настроить меню»; без права — заглушка, как в конструкторе дизайна.
 */
export const MenuSettingsPage: FC = () => {
  const { t } = useTranslation()

  const { data: me, isPending } = useQuery({
    queryKey: ['menu-settings-me'],
    queryFn: ({ signal }) => menuSettingsApi.me(signal),
  })

  if (!isPending && me?.canManage !== true) {
    return (
      <div className="p-8">
        <Typography variant="body1">
          {t('sdui.menuSettings.forbidden')}
        </Typography>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 p-8">
      <div>
        <Typography variant="h5">{t('sdui.menuSettings.title')}</Typography>
        <Typography variant="body2" className="text-ui-05">
          {t('sdui.menuSettings.subtitle')}
        </Typography>
      </div>
      <div className="min-h-0 max-w-3xl flex-1">
        <MenuSettingsEditor initialScope={{ kind: 'global' }} />
      </div>
    </div>
  )
}
