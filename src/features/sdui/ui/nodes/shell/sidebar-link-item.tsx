import type { FC } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Typography } from '@mui/material'

import { cn } from '@/shared/lib/utils/cn'

import type { ViewNode } from '../../../types/view'
import { resolveShellIcon } from '../../../lib/shell/icon-resolver'

const buttonStyles = (isActive: boolean, isCollapsed: boolean) =>
  cn(
    'flex w-full max-h-14 items-center gap-3 rounded-lg py-2 text-left text-base text-ui-01 transition-colors',
    isCollapsed ? 'justify-center px-2' : 'justify-start pl-4',
    isActive && 'bg-ui-01 text-ui-06',
    !isActive && 'cursor-pointer hover:bg-ui-01/10'
  )

const iconWrapStyles = (isActive: boolean) =>
  cn(
    'flex justify-center min-w-10 min-h-10 rounded-lg items-center',
    isActive ? 'bg-accent-01' : 'bg-ui-06'
  )

const iconStyles = (isActive: boolean) =>
  cn('w-6 h-6 shrink-0', isActive ? 'text-ui-06' : 'text-ui-01')

interface SidebarLinkItemProps {
  node: ViewNode
  collapsed: boolean
}

export const SidebarLinkItem: FC<SidebarLinkItemProps> = ({
  node,
  collapsed,
}) => {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const label = (node.props?.label as string | undefined) ?? ''
  const route = (node.props?.route as string | undefined) ?? '/'
  const iconName = node.props?.icon as string | undefined
  const Icon = resolveShellIcon(iconName)

  const isActive = route === '/' ? pathname === '/' : pathname.startsWith(route)

  return (
    <button
      type="button"
      onClick={() => {
        void navigate(route)
      }}
      aria-current={isActive ? 'page' : undefined}
      className={buttonStyles(isActive, collapsed)}
    >
      <div className={iconWrapStyles(isActive)}>
        {/* Icon — статичный компонент из карты по имени (resolveShellIcon), а не
            инлайн-объявление; правило здесь ложно срабатывает. */}
        {/* eslint-disable-next-line react-hooks/static-components */}
        <Icon className={iconStyles(isActive)} />
      </div>
      {!collapsed && <Typography variant="body2">{label}</Typography>}
    </button>
  )
}
