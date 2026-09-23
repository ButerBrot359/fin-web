import { onToastShown, type ToastEvent } from '@/shared/ui/toast/show-toast'

import { useNotificationHistoryStore } from '../model/notification-history-store'

const HISTORY_LEVELS: ReadonlySet<ToastEvent['type']> = new Set([
  'error',
  'warning',
])

/**
 * Подписывает историю оповещений на показанные всплывашки уровней ошибки и
 * предупреждения (SCRUM-317 канал №8). Успех и справочные сообщения в историю
 * не попадают: результат удачного действия виден на форме. Вызывается один раз
 * на уровне app/; возвращает отписку.
 */
export function connectToastHistory(): () => void {
  return onToastShown((event) => {
    if (!HISTORY_LEVELS.has(event.type)) {
      return
    }
    useNotificationHistoryStore.getState().add({
      level: event.type,
      title: event.title,
      description: event.description,
      route: event.route ?? null,
      at: Date.now(),
    })
  })
}
