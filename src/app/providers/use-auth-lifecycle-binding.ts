import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import {
  closeSduiSessionsForSignOut,
  resetSduiClientState,
  resumeSduiClose,
} from '@/features/sdui'
import {
  useFormCacheStore,
  useWorkspaceTabsStore,
} from '@/features/workspace-tabs'
import { setAuthLifecycleHooks } from '@/shared/api/auth/auth-lifecycle'

/**
 * Связывает жизненный цикл личности (shared/api/auth/auth-lifecycle) с SDUI,
 * рабочими вкладками и QueryClient (SCRUM-400 §10, ADR-0088 §2.12). Живёт в
 * app-слое: только он вправе знать обо всех участниках сразу — shared не
 * импортирует features, SDUI не знает про QueryClient приложения.
 */
export function useAuthLifecycleBinding(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    setAuthLifecycleHooks({
      // Выход: CLOSE всех SDUI-сессий, пока токен ещё жив (потолок — в lifecycle).
      onBeforeSignOut: closeSduiSessionsForSignOut,
      // Смена личности: следующий пользователь не должен увидеть ни чужих
      // данных из кэшей запросов, ни чужого дерева/вкладок.
      onIdentityReset: () => {
        void queryClient.cancelQueries()
        queryClient.clear()
        resetSduiClientState()
        useWorkspaceTabsStore.setState({ tabs: [] })
        useFormCacheStore.setState({ cache: {} })
      },
      // Вошли заново — CLOSE сессий снова разрешён (гасился на выходе).
      onSignedIn: resumeSduiClose,
    })
  }, [queryClient])
}
