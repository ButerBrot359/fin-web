import type { FaceVerifyOutcome } from '../types/face-auth'

/**
 * Ключ сообщения для исхода попытки входа по лицу.
 *
 * Отдельная чистая функция, а не `switch` внутри компонента, — потому что здесь легко
 * ошибиться в пользу «более информативного» текста. Сервер намеренно не различает в ответе
 * «лицо не живое» и «лицо не то» (иначе подбор получал бы обратную связь), и клиент не вправе
 * додумывать причину за него.
 *
 * `null` означает «сообщать нечего» — успех или ещё не завершённая попытка.
 */
export function faceOutcomeMessageKey(
  outcome: FaceVerifyOutcome | null
): string | null {
  if (outcome === null) {
    return null
  }

  switch (outcome.kind) {
    case 'success':
      return null
    case 'rejected':
      return 'auth.face.errorRejected'
    case 'rateLimited':
      return 'auth.face.errorRateLimited'
    case 'unavailable':
      return 'auth.face.errorUnavailable'
    case 'quality':
      // Единственный случай, когда причина известна и её можно показать: сервер сам назвал
      // её из фиксированного перечня, и она про материал съёмки, а не про личность.
      return `auth.face.quality${outcome.reason}`
    case 'clientError':
      return clientErrorKey(outcome.detail)
  }
}

/**
 * Отказ камеры разбирается по имени DOMException.
 *
 * Различать стоит ровно два случая, и оба — действия пользователя: он запретил доступ либо
 * камеры нет вовсе. Всё прочее (сеть, отмена, внутренняя ошибка) сваливается в общий текст:
 * подробности здесь ничем не помогут человеку, который просто хочет войти.
 */
function clientErrorKey(detail: string): string {
  if (detail === 'NotAllowedError' || detail === 'SecurityError') {
    return 'auth.face.errorCameraDenied'
  }
  if (detail === 'NotFoundError' || detail === 'DevicesNotFoundError') {
    return 'auth.face.errorCameraMissing'
  }
  return 'auth.face.errorGeneric'
}
