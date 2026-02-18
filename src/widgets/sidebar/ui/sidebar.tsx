import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import Logo from '@/shared/assets/logo.svg'
import { cn } from '@/shared/lib/utils/cn'

import { useSidebar } from '../lib/hooks/use-sidebar'

const getButtonStyles = (isActive: boolean, isDisabled: boolean) =>
  cn(
    'flex w-full justify-start max-h-14 items-center gap-3 rounded-lg pl-4 py-2 text-left text-base text-ui-01 transition-colors',
    isActive && 'bg-ui-01 text-ui-06',
    isDisabled && 'cursor-not-allowed opacity-50',
    !isActive && !isDisabled && 'cursor-pointer hover:bg-ui-01/10'
  )

const getIconWrapStyles = (isActive: boolean) =>
  cn(
    'flex justify-center min-w-10 min-h-10 rounded-lg items-center',
    isActive ? 'bg-accent-01' : 'bg-ui-06'
  )

const getIconStyles = (isActive: boolean) =>
  cn('w-6 h-6 shrink-0', isActive ? 'text-ui-06' : 'text-ui-01')

export const Sidebar = () => {
  const { t } = useTranslation()
  const { navigationItems, activeItem, handleSelectItem } = useSidebar()

  return (
    <aside className="w-103 shrink-0 pl-15 py-10 pr-5">
      <div className="flex items-center gap-5 pl-5 mb-15">
        <Logo className="w-10 h-10 shrink-0" />
        <Typography variant="h6" className="text-ui-01">
          {t('sidebar.appName')}
        </Typography>
      </div>
      <nav>
        <ul className="flex flex-col">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = activeItem?.id === item.id
            const isDisabled = Boolean(item.disabled)

            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    void handleSelectItem(item)
                  }}
                  className={getButtonStyles(isActive, isDisabled)}
                >
                  <div className={getIconWrapStyles(isActive)}>
                    <Icon className={getIconStyles(isActive)} />
                  </div>
                  <Typography variant="body2">
                    {t(item.labelKey as never)}
                  </Typography>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
