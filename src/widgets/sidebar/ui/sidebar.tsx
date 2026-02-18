import { IconButton, Typography } from '@mui/material'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'

import Logo from '@/shared/assets/logo.svg'
import { cn } from '@/shared/lib/utils/cn'

import { useSidebar } from '../lib/hooks/use-sidebar'

const getButtonStyles = (
  isActive: boolean,
  isDisabled: boolean,
  isCollapsed: boolean
) =>
  cn(
    'flex w-full max-h-14 items-center gap-3 rounded-lg py-2 text-left text-base text-ui-01 transition-colors',
    isCollapsed ? 'justify-center px-2' : 'justify-start pl-4',
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
  const {
    navigationItems,
    activeItem,
    handleSelectItem,
    isCollapsed,
    toggleCollapsed,
  } = useSidebar()

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col py-10 transition-all duration-300',
        isCollapsed ? 'w-20 px-2' : 'w-103 pl-15 pr-5'
      )}
    >
      <div
        className={cn(
          'mb-15 flex items-center',
          isCollapsed ? 'justify-center' : 'gap-5 pl-5'
        )}
      >
        <Logo className="h-10 w-10 shrink-0" />
        {!isCollapsed && (
          <Typography variant="h6" className="text-ui-01">
            {t('sidebar.appName')}
          </Typography>
        )}
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
                  className={getButtonStyles(isActive, isDisabled, isCollapsed)}
                >
                  <div className={getIconWrapStyles(isActive)}>
                    <Icon className={getIconStyles(isActive)} />
                  </div>
                  {!isCollapsed && (
                    <Typography variant="body2">
                      {t(item.labelKey as never)}
                    </Typography>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
      <div
        className={cn(
          'mt-auto flex',
          isCollapsed ? 'justify-center' : 'justify-end pr-2'
        )}
      >
        <IconButton onClick={toggleCollapsed} size="small">
          {isCollapsed ? (
            <ChevronRight className="text-ui-01" />
          ) : (
            <ChevronLeft className="text-ui-01" />
          )}
        </IconButton>
      </div>
    </aside>
  )
}
