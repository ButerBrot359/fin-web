import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'

interface NavigationItem {
  id: string
  labelKey: string
  path?: string
}

export const usePageTitle = (path: string, fallback: string) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const navigationItems =
    queryClient.getQueryData<NavigationItem[]>(['navigation-items']) ?? []
  const navItem = navigationItems.find((item) => item.path === path)

  return navItem ? t(navItem.labelKey as never) : fallback
}
