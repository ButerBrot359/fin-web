import { viewTransport } from '../api/view-transport'
import { useTreeStore } from './stores/tree-store'
import { usePanelStore } from './stores/panel-store'
import { useSduiCacheStore } from './stores/sdui-cache-store'
import { useViewStateStore } from './stores/view-state-store'
import { useCommandInflightStore } from './stores/command-inflight-store'
import { useScreenAccessStore } from './access/screen-access-store'
import { clearAllFormSessions } from './form-session-storage'
import { dropAllDeferredResponses } from './deferred-responses'
import { resetServerAuthGeneration } from './access/server-auth-generation'

/**
 * CLOSE после выхода отправлять нельзя (§10 п.5): без токена он ответит 401 и
 * породит ложное «сессия истекла». Флаг ставится на выходе и снимается при
 * следующем успешном входе (app-слой, auth-lifecycle onSignedIn).
 */
let closeSuppressed = false

export const suppressSduiClose = (): void => {
  closeSuppressed = true
}

export const resumeSduiClose = (): void => {
  closeSuppressed = false
}

export const isSduiCloseSuppressed = (): boolean => closeSuppressed

/**
 * Закрыть ВСЕ живые SDUI-сессии вкладки перед выходом (SCRUM-400 §10 п.1):
 * активную форму, панели и сессии, закэшированные рабочими вкладками. Зовётся,
 * пока токен ещё есть; потолок по времени держит auth-lifecycle.
 */
export async function closeSduiSessionsForSignOut(): Promise<void> {
  suppressSduiClose()
  const ids = new Set<string>()
  const active = useTreeStore.getState().formSessionId
  if (active) ids.add(active)
  for (const panel of usePanelStore.getState().panels) {
    if (panel.session?.formSessionId) ids.add(panel.session.formSessionId)
  }
  for (const entry of Object.values(useSduiCacheStore.getState().cache)) {
    if (entry.formSessionId) ids.add(entry.formSessionId)
  }
  if (ids.size === 0) return
  await Promise.allSettled(
    [...ids].map((formSessionId) =>
      viewTransport.post({ formSessionId, action: { type: 'CLOSE' } })
    )
  )
}

/**
 * Сброс клиентского состояния SDUI при смене личности (SCRUM-400 §10 п.2):
 * следующий вошедший не должен увидеть ни чужого дерева, ни чужих значений,
 * ни чужих отказов. Вызывается app-слоем из identity-reset.
 */
export function resetSduiClientState(): void {
  useTreeStore.getState().reset()
  useViewStateStore.getState().replaceAll({})
  usePanelStore.getState().reset()
  useSduiCacheStore.getState().clear()
  useScreenAccessStore.getState().clearAll()
  useCommandInflightStore.setState({ sessions: {} })
  clearAllFormSessions()
  dropAllDeferredResponses()
  resetServerAuthGeneration()
}
