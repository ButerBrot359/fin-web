import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchNavigationItems } from '../../api/fetch-navigation-items'

export function useSidebar() {
  const { data: navigationItems = [] } = useQuery({
    queryKey: ['navigation-items'],
    queryFn: fetchNavigationItems,
  })

  const [activeItemId, setActiveItemId] = useState<string>('main')

  const activeItem = useMemo(
    () => navigationItems.find((item) => item.id === activeItemId) ?? null,
    [navigationItems, activeItemId]
  )

  const handleSelectItem = useCallback((id: string) => {
    setActiveItemId(id)
  }, [])

  return {
    navigationItems,
    activeItem,
    handleSelectItem,
  }
}
