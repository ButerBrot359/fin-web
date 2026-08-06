import { useState, type FC } from 'react'
import { IconButton, Typography } from '@mui/material'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'

import Logo from '@/shared/assets/logo.svg'
import { cn } from '@/shared/lib/utils/cn'
import {
  getStorageItem,
  setStorageItem,
} from '@/shared/lib/utils/local-storage'

import type { NodeProps } from '../../../types/view'
import { SidebarLinkItem } from './sidebar-link-item'

const STORAGE_KEY = 'sidebar-settings'

export const SidebarNode: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const initial = (node.props?.collapsed as boolean | undefined) ?? false
    return getStorageItem<{ isCollapsed: boolean }>(STORAGE_KEY, {
      isCollapsed: initial,
    }).isCollapsed
  })

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      setStorageItem(STORAGE_KEY, { isCollapsed: next })
      return next
    })
  }

  const links = node.children ?? []

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col py-10 transition-all duration-300',
        collapsed ? 'w-20 px-2' : 'w-103 pl-15 pr-5'
      )}
    >
      <div
        className={cn(
          'mb-15 flex items-center',
          collapsed ? 'justify-center' : 'gap-5 pl-5'
        )}
      >
        <Logo className="h-10 w-10 shrink-0" />
        {!collapsed && (
          <Typography variant="h6" className="text-ui-01">
            {t('sidebar.appName')}
          </Typography>
        )}
      </div>
      <nav>
        <ul className="flex flex-col">
          {links.map((child) => (
            <li key={child.id}>
              <SidebarLinkItem node={child} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </nav>
      <div
        className={cn(
          'mt-auto flex',
          collapsed ? 'justify-center' : 'justify-end pr-2'
        )}
      >
        <IconButton
          onClick={toggle}
          size="small"
          aria-label={t('sidebar.toggleCollapse')}
        >
          {collapsed ? (
            <ChevronRight className="text-ui-01" />
          ) : (
            <ChevronLeft className="text-ui-01" />
          )}
        </IconButton>
      </div>
    </aside>
  )
}
