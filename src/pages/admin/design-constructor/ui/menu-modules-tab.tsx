import type { FC } from 'react'
import { Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { menuSettingsApi, MenuSettingsEditor } from '@/features/sdui'

/**
 * Вкладка «Настройка модулей» админки конструктора (SCRUM-426, решение владельца
 * 24.09): состав и порядок бокового меню и разделов модулей. Обладатель права
 * «Настройка меню» стартует с уровня «Для всех» и получает селектор уровней;
 * без права редактируется личный слой.
 */
export const MenuModulesTab: FC = () => {
  const { t } = useTranslation()

  const { data: me, isPending } = useQuery({
    queryKey: ['menu-settings-me'],
    queryFn: ({ signal }) => menuSettingsApi.me(signal),
  })

  if (isPending) {
    return (
      <Typography variant="body2" className="text-ui-05">
        {t('sdui.menuSettings.loading')}
      </Typography>
    )
  }

  return (
    <div className="flex min-h-0 max-w-3xl flex-1 flex-col">
      <MenuSettingsEditor
        initialScope={
          me?.canManage === true ? { kind: 'global' } : { kind: 'my' }
        }
      />
    </div>
  )
}
