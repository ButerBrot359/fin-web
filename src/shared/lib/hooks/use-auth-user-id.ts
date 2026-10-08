import { useSyncExternalStore } from 'react'

import { subscribeAuthGeneration } from '@/shared/api/auth/auth-generation'
import { getStoredUser } from '@/shared/api/auth/token-storage'

// id меняется только со сменой поколения авторизации — кэшируем, чтобы не
// гонять localStorage + JSON.parse на каждом рендере каждого подписчика.
let cachedUserId: number | null | undefined
subscribeAuthGeneration(() => {
  cachedUserId = undefined
})

const getUserIdSnapshot = (): number | null => {
  cachedUserId ??= getStoredUser()?.id ?? null
  return cachedUserId
}

/**
 * id текущего пользователя для ключей TanStack Query (SCRUM-400 §10 п.3):
 * запросы со `staleTime: Infinity`, зависящие от прав (меню, тема), обязаны
 * различать пользователей в одной вкладке. Подписка — на поколение
 * авторизации: оно меняется ровно при входе/выходе/обрыве.
 */
export function useAuthUserId(): number | null {
  return useSyncExternalStore(subscribeAuthGeneration, getUserIdSnapshot)
}
