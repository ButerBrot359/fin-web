import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

interface NavigationItem {
  id: string
  label: string
  path: string
}

export const usePageTitle = (path: string, fallback: string) => {
  const { i18n } = useTranslation()
  const queryClient = useQueryClient()

  const navigationItems =
    queryClient.getQueryData<NavigationItem[]>([
      'navigation-items',
      i18n.language,
    ]) ?? []
  const navItem = navigationItems.find((item) => item.path === path)

  return navItem ? navItem.label : fallback
}
