import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import {
  getStorageItem,
  setStorageItem,
} from '@/shared/lib/utils/local-storage'
import { fetchNavigationItems } from '../../api/fetch-navigation-items'
import type { NavigationItem } from '../../types/types'

interface SidebarSettings {
  isCollapsed: boolean
}

const STORAGE_KEY = 'sidebar-settings'

const DEFAULT_SETTINGS: SidebarSettings = {
  isCollapsed: false,
}

export function useSidebar() {
  const { data: navigationItems = [] } = useQuery({
    queryKey: ['navigation-items'],
    queryFn: fetchNavigationItems,
  })

  const [settings, setSettings] = useState<SidebarSettings>(() =>
    getStorageItem(STORAGE_KEY, DEFAULT_SETTINGS)
  )

  const updateSettings = useCallback((patch: Partial<SidebarSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      setStorageItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  const toggleCollapsed = useCallback(() => {
    updateSettings({ isCollapsed: !settings.isCollapsed })
  }, [settings.isCollapsed, updateSettings])

  const navigate = useNavigate()
  const location = useLocation()

  const activeItem = useMemo(
    () =>
      navigationItems.find((item) => {
        if (!item.path) return false
        if (item.path === '/') return location.pathname === '/'
        return location.pathname.startsWith(item.path)
      }) ?? null,
    [navigationItems, location.pathname]
  )

  const handleSelectItem = useCallback(
    async (item: NavigationItem) => {
      if (item.path) {
        await navigate(item.path)
      }
    },
    [navigate]
  )

  return {
    navigationItems,
    activeItem,
    handleSelectItem,
    isCollapsed: settings.isCollapsed,
    toggleCollapsed,
  }
}
