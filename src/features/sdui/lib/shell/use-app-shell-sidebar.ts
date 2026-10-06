import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useAuthUserId } from '@/shared/lib/hooks/use-auth-user-id'

import type { ViewNode } from '../../types/view'
import { fetchAppShellTree, findSidebarNode } from '../../api/fetch-app-shell'

interface AppShellSidebar {
  sidebarNode: ViewNode | null
  isPending: boolean
  isError: boolean
}

export function useAppShellSidebar(): AppShellSidebar {
  const { i18n } = useTranslation()
  // SCRUM-400 §10 п.3: меню зависит от ПРАВ пользователя — userId в ключе,
  // чтобы следующий вошедший в той же вкладке не увидел чужого меню (вторая
  // линия защиты после clear() при смене личности).
  const userId = useAuthUserId()

  // Ключ включает язык: метки RU/KZ фиксируются на OPEN, смена языка → ре-фетч.
  // Меню статично в рамках сессии/языка (новый модуль = релиз бэка) → staleTime Infinity.
  const query = useQuery({
    queryKey: ['app-shell', i18n.language, userId],
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
