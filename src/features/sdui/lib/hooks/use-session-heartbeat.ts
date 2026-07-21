import { useEffect } from 'react'

import { viewTransport } from '../../api/view-transport'

// 10 минут — рекомендация спеки SCRUM-244 §2.2 (idle-TTL сессии заметно больше)
export const HEARTBEAT_INTERVAL_MS = 10 * 60_000

/**
 * Пинг form-session, пока форма смонтирована: между вводом полей запросов нет,
 * без пинга сессия истекает по idle-TTL и набранный ввод теряется на первом
 * «Записать». На 404 пинг молча останавливается: следующее действие пользователя
 * получит 409 и пройдёт штатное восстановление (conflict-handler → reopen).
 */
export function useSessionHeartbeat(formSessionId: string | null): void {
  useEffect(() => {
    if (!formSessionId) return
    const id = setInterval(() => {
      void viewTransport.heartbeat(formSessionId).then((alive) => {
        if (!alive) clearInterval(id)
      })
    }, HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [formSessionId])
}
