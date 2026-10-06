/**
 * Серверное поколение авторизации (SCRUM-400 §3.5): `authGeneration` приходит
 * в каждом ответе `/api/view`, монотонно не убывает ДЛЯ ОДНОГО пользователя и
 * растёт при публикации изменения его прав. Храним максимум: ответ с меньшим
 * значением пришёл поздно и не должен откатывать уже применённые
 * `enabled`/`readOnly`-патчи — такой ответ отбрасывается целиком (допустимое
 * по спеке, более жёсткое решение). `null` — «сигнал недоступен», не ноль.
 */

let maxGeneration: number | null = null

/** @returns false — ответ из прошлого поколения, применять нельзя. */
export function observeServerAuthGeneration(
  value: number | null | undefined
): boolean {
  if (value == null) return true
  if (maxGeneration === null || value >= maxGeneration) {
    maxGeneration = value
    return true
  }
  return false
}

/** Смена пользователя: между пользователями значения не сравниваются. */
export function resetServerAuthGeneration(): void {
  maxGeneration = null
}
