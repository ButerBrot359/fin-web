import type { ActionBehavior, ViewAction } from '../types/view'

/**
 * После восстановления сессии (SESSION_NOT_FOUND → reopen) повторяем исходное
 * действие, чтобы клик пользователя не терялся. Исключение — команды записи:
 * их scratch-состояние умерло вместе с сессией, повтор сохранил бы пустую
 * форму поверх данных. Маркеры записи — resetsDirty/closeAfter из контракта
 * Actions (SCRUM-283).
 */
export function isRetryableAfterReopen(
  action: ViewAction,
  behavior?: ActionBehavior | null,
): boolean {
  if (action.type === 'OPEN' || action.type === 'CLOSE') return false
  if (action.type === 'COMMAND' && (behavior?.resetsDirty || behavior?.closeAfter)) {
    return false
  }
  return true
}
