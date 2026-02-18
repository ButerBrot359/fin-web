import { useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { fetchNavigationItems } from '../../api/fetch-navigation-items'
import type { NavigationItem } from '../../types/types'

export function useSidebar() {
  const { data: navigationItems = [] } = useQuery({
    queryKey: ['navigation-items'],
    queryFn: fetchNavigationItems,
  })

  const navigate = useNavigate()
  const location = useLocation()

  const activeItem = useMemo(
    () =>
      navigationItems.find((item) => item.path === location.pathname) ?? null,
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
  }
}
