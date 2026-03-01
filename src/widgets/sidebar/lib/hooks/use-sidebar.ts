import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { fetchNavigationItems } from '../../api/fetch-navigation-items'
import type { NavigationItem } from '../../types/types'

export function useSidebar() {
  const { data: navigationItems = [] } = useQuery({
    queryKey: ['navigation-items'],
    queryFn: fetchNavigationItems,
  })

  const [isCollapsed, setIsCollapsed] = useState(false)

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev)
  }, [])

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
    isCollapsed,
    toggleCollapsed,
  }
}
