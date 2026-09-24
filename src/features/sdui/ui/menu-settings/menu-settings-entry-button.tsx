import type { FC } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/utils/cn'
import { figmaIcons } from '@/shared/ui/icons'

/**
 * Постоянный вход «Настроить меню» внизу сайдбара, над кнопкой сворачивания
 * (решение владельца 25.09): доступен всем — обычный пользователь правит личный
 * слой, обладатель права получает селектор уровней. Стиль и поведение — как у
 * пунктов меню ({@code SidebarLinkItem}): та же плашка, ховер, при свёрнутом
 * сайдбаре остаётся только иконка.
 */
export const MenuSettingsEntryButton: FC<{ collapsed: boolean }> = ({
  collapsed,
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isActive = pathname.startsWith('/admin/design-constructor')

  return (
    <button
      type="button"
      onClick={() => {
        void navigate('/admin/design-constructor?tab=menu')
      }}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex max-h-14 w-full items-center gap-3 rounded-2xl py-2 text-left text-base text-ui-01 transition-colors',
        collapsed ? 'justify-center px-2' : 'justify-start pl-5',
        isActive && 'bg-ui-01 text-ui-06',
        !isActive && 'cursor-pointer hover:bg-ui-01/10'
      )}
    >
      <div
        className={cn(
          'flex min-h-10 min-w-10 items-center justify-center rounded-lg',
          isActive ? 'bg-accent-01' : 'bg-ui-06'
        )}
      >
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center',
            isActive ? 'text-ui-06' : 'text-ui-01'
          )}
        >
          {figmaIcons['settings-2']}
        </span>
      </div>
      {!collapsed && (
        <Typography variant="body1" className="truncate">
          {t('sdui.menuSettings.entryButton')}
        </Typography>
      )}
    </button>
  )
}
