/**
 * Канал «сессия закончилась» из транспортного слоя в React.
 *
 * Обнаруживает конец сессии интерсептор axios — код без доступа к роутеру и к сторам.
 * Прямой импорт стора из `shared/` запрещён направлением зависимостей FSD, а держать
 * редирект внутри интерсептора (`window.location.href = ...`) значит перезагружать
 * приложение целиком и терять несохранённое. Поэтому — подписка: `shared` объявляет
 * событие, `app`/`features` на него реагируют.
 */

type SessionExpiredListener = () => void

const listeners = new Set<SessionExpiredListener>()

/** @returns функция отписки — вызывать в cleanup эффекта. */
export const onSessionExpired = (
  listener: SessionExpiredListener
): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Сессию продлить не удалось: refresh истёк, отозван или пользователя больше не пускают.
 *
 * Слушатель может отсутствовать (событие пришло до монтирования React) — это не ошибка:
 * токены к этому моменту уже стёрты, и первый же защищённый маршрут отправит на вход.
 */
export const emitSessionExpired = (): void => {
  listeners.forEach((listener) => {
    try {
      listener()
    } catch {
      // Падение одного подписчика не должно мешать остальным узнать о конце сессии.
    }
  })
}
