import { useSyncExternalStore } from 'react'

import { subscribeAuthGeneration } from '@/shared/api/auth/auth-generation'
import { getStoredUser } from '@/shared/api/auth/token-storage'

/**
 * id текущего пользователя для ключей TanStack Query (SCRUM-400 §10 п.3):
 * запросы со `staleTime: Infinity`, зависящие от прав (меню, тема), обязаны
 * различать пользователей в одной вкладке. Подписка — на поколение
 * авторизации: оно меняется ровно при входе/выходе/обрыве.
 */
export function useAuthUserId(): number | null {
  return useSyncExternalStore(
    subscribeAuthGeneration,
    () => getStoredUser()?.id ?? null
  )
}
