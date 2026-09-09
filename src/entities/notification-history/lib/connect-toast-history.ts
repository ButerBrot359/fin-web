import { onToastShown } from '@/shared/ui/toast/show-toast'

import { useNotificationHistoryStore } from '../model/notification-history-store'

/**
 * Подписывает историю оповещений на все показанные всплывашки (SCRUM-317
 * канал №8). Вызывается один раз на уровне app/; возвращает отписку.
 */
export function connectToastHistory(): () => void {
  return onToastShown((event) => {
    useNotificationHistoryStore.getState().add({
      level: event.type,
      title: event.title,
      description: event.description,
      route: event.route ?? null,
      at: Date.now(),
    })
  })
}
