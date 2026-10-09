/**
 * Канал «сессия закончилась» из транспортного слоя в React.
 *
 * Обнаруживает конец сессии интерсептор axios — код без доступа к роутеру и к сторам.
 * Прямой импорт стора из `shared/` запрещён направлением зависимостей FSD, а держать
 * редирект внутри интерсептора (`window.location.href = ...`) значит перезагружать
 * приложение целиком и терять несохранённое. Поэтому — подписка: `shared` объявляет
 * событие, `app`/`features` на него реагируют.
 */

type SessionExpiredListener = (message?: string) => void

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
 *
 * @param message серверный текст причины (SCRUM-400: `403 ACCOUNT_INELIGIBLE` несёт
 * «Вход запрещён: …» — экран входа показывает его вместо общего «сессия истекла»).
 */
export const emitSessionExpired = (message?: string): void => {
  listeners.forEach((listener) => {
    try {
      listener(message)
    } catch {
      // Падение одного подписчика не должно мешать остальным узнать о конце сессии.
    }
  })
}

type PasswordChangeRequiredListener = () => void

const passwordChangeListeners = new Set<PasswordChangeRequiredListener>()

/**
 * Серверный фильтр ответил «Требуется сменить пароль» на произвольном запросе
 * (SCRUM-400 §4.3): признак включили ПОСЛЕ входа, и `mustChangePassword` в
 * сохранённом пользователе ещё false. Подписчик (гвард) уводит на экран смены
 * пароля — этот 403 не должен попасть в общий предикат «отказ по правам».
 */
export const onPasswordChangeRequired = (
  listener: PasswordChangeRequiredListener
): (() => void) => {
  passwordChangeListeners.add(listener)
  return () => {
    passwordChangeListeners.delete(listener)
  }
}

export const emitPasswordChangeRequired = (): void => {
  passwordChangeListeners.forEach((listener) => {
    try {
      listener()
    } catch {
      // см. emitSessionExpired
    }
  })
}
