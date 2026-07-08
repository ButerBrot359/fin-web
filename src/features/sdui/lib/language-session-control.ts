import { viewTransport } from '../api/view-transport'
import { useSduiCacheStore } from './stores/sdui-cache-store'
import { useViewStateStore } from './stores/view-state-store'

// Публичный API для оркестрации переключения языка (SCRUM-268).
// Потребитель — top-bar (widget → feature, легально по FSD).

export function hasSduiUnsavedWork(): boolean {
  if (useViewStateStore.getState().dirty) return true
  const { cache } = useSduiCacheStore.getState()
  return Object.values(cache).some((entry) => entry.dirty)
}

// CLOSE всех закэшированных form-session (best-effort) + полная очистка кэша.
// Вызывать ДО i18n.changeLanguage: иначе restore-ветка sdui-screen
// воскресит стейл-сессию на старом языке.
export async function closeAllSduiSessions(): Promise<void> {
  const { cache } = useSduiCacheStore.getState()
  const closes = Object.values(cache)
    .filter((entry) => entry.formSessionId != null)
    .map((entry) =>
      viewTransport
        .post({ formSessionId: entry.formSessionId, action: { type: 'CLOSE' } })
        .catch(() => undefined),
    )
  await Promise.all(closes)
  useSduiCacheStore.getState().clear()
}
