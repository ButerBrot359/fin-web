import { viewTransport } from '../api/view-transport'
import { useSduiCacheStore } from './stores/sdui-cache-store'

// SCRUM-276 (черновики форм): «Не сохранять» при закрытии вкладки должно
// уйти на сервер как CLOSE c discardDraft=true — иначе брошенный черновик
// всплывёт при следующем открытии той же формы. Обычная навигация шлёт CLOSE
// без флага (черновик сохраняется) — это различие и есть контракт §3.1.

// Интенты «закрыть со сбросом черновика» по маршруту. Живут мгновение:
// ставятся строго между ответом «Не сохранять» и размонтированием экрана.
const discardIntents = new Set<string>()

/** Пометить: ближайший CLOSE экрана на этом маршруте — со сбросом черновика. */
export function markDiscardDraftClose(route: string): void {
  discardIntents.add(route)
}

/** Забрать интент (одноразовый). */
export function consumeDiscardDraftClose(route: string): boolean {
  const has = discardIntents.has(route)
  discardIntents.delete(route)
  return has
}

/** Снять залежавшийся интент — вызывается на монтировании экрана. */
export function clearDiscardDraftClose(route: string): void {
  discardIntents.delete(route)
}

/**
 * Обработчик discard-закрытия workspace-вкладки (реестр workspace-tabs,
 * подписка на уровне app/). Неактивная вкладка держит форму в sdui-кэше —
 * экран размонтирован, CLOSE шлём транспортом напрямую и чистим кэш
 * (заодно закрывая утечку: раньше такая сессия не закрывалась вовсе).
 * Активная вкладка кэша не имеет — помечаем интент, его заберёт
 * cleanup SduiScreen при размонтировании.
 */
export function discardTabSession(route: string): void {
  const cached = useSduiCacheStore.getState().get(route)
  if (cached) {
    if (cached.formSessionId != null) {
      void viewTransport
        .post({
          formSessionId: cached.formSessionId,
          revision: cached.revision,
          route,
          action: { type: 'CLOSE', discardDraft: true },
        })
        .catch(() => {
          // Сессия могла истечь по TTL — закрывать уже нечего.
        })
    }
    useSduiCacheStore.getState().remove(route)
    return
  }
  markDiscardDraftClose(route)
}
