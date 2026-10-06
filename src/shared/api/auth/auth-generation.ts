/**
 * Клиентское «поколение авторизации» (SCRUM-400 §10, ADR-0088 §2.12).
 *
 * Монотонный счётчик личности: растёт при входе, выходе и обрыве сессии.
 * Интерсептор axios помечает каждый запрос поколением на отправке и
 * ОТБРАСЫВАЕТ ответ, пришедший в чужом поколении, до любых обработчиков:
 * поздний 403 прежнего пользователя не закроет форму нового, поздний allow
 * не вернёт снятые возможности, поздний 422 не подсветит поля.
 */

let generation = 0
const listeners = new Set<() => void>()

export const getAuthGeneration = (): number => generation

export const bumpAuthGeneration = (): void => {
  generation += 1
  listeners.forEach((listener) => {
    try {
      listener()
    } catch {
      // Падение одного подписчика не мешает остальным.
    }
  })
}

/** Подписка (useSyncExternalStore). @returns функция отписки. */
export const subscribeAuthGeneration = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
