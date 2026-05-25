import { useQueryClient } from '@tanstack/react-query'

interface NavigationItem {
  id: string
  label: string
  path: string
}

export const usePageTitle = (path: string, fallback: string) => {
  const queryClient = useQueryClient()

  const navigationItems =
    queryClient.getQueryData<NavigationItem[]>(['navigation-items']) ?? []
  const navItem = navigationItems.find((item) => item.path === path)

  return navItem ? navItem.label : fallback
}
