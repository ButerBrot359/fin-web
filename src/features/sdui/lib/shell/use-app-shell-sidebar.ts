import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import type { ViewNode } from '../../types/view'
import { fetchAppShellTree, findSidebarNode } from '../../api/fetch-app-shell'

interface AppShellSidebar {
  sidebarNode: ViewNode | null
  isPending: boolean
  isError: boolean
}

export function useAppShellSidebar(): AppShellSidebar {
  const { i18n } = useTranslation()

  // Ключ включает язык: метки RU/KZ фиксируются на OPEN, смена языка → ре-фетч.
  // Меню статично в рамках сессии/языка (новый модуль = релиз бэка) → staleTime Infinity.
  const query = useQuery({
    queryKey: ['app-shell', i18n.language],
    queryFn: fetchAppShellTree,
    staleTime: Infinity,
    retry: false,
  })

  return {
    sidebarNode: findSidebarNode(query.data ?? null),
    isPending: query.isPending,
    isError: query.isError,
  }
}
