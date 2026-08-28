/**
 * Контракт контура аутентификации бэкенда (SCRUM-373).
 *
 * Источник: `docs/project/frontend-handoff-SCRUM-373-jwt-avtorizatsiya.md` в репозитории
 * webbuh, раздел 2. Поля названы ровно так, как их отдаёт сервер, — переименований нет
 * намеренно: расхождение имён между слоями ловится только в рантайме.
 */

/** Внутренний сотрудник или внешний пользователь (аналог двух справочников 1С). */
export type UserKind = 'INTERNAL' | 'EXTERNAL'

export interface CurrentUser {
  id: number
  /**
   * Логин в том написании, в каком заведён.
   *
   * В 1С это, как правило, «Фамилия Имя» — с пробелом и кириллицей. Показываем как есть,
   * не приводим регистр и не режем пробелы.
   */
  login: string
  /**
   * Представление пользователя — наименование элемента справочника «Пользователи».
   * Та же строка, которой он виден в поле «Ответственный»/«Исполнитель» документа.
   */
  displayName: string | null
  /**
   * Id элемента справочника «Пользователи» — самого пользователя. Приходит всегда:
   * учётной записи без элемента справочника не существует, вход под такой отклоняется.
   * Это значение подставляется как значение ссылочного поля «Ответственный».
   */
  userEntryId: number | null
  /** Код типа справочника для `userEntryId` — всегда `Polzovateli`. */
  userTypeCode: string | null
  userKind: UserKind
  /** `Ru` / `Kz` / `null`. */
  language: string | null
  /**
   * Требуется смена пароля при входе. Пользователь при этом СЧИТАЕТСЯ вошедшим —
   * сервер не отвечает 401, ограничить доступ формой смены пароля обязан клиент.
   */
  mustChangePassword: boolean
  /** Самостоятельная смена пароля запрещена администратором. */
  passwordChangeDisabled: boolean
}

/** Ответ `POST /api/auth/login` и `POST /api/auth/refresh`. */
export interface TokenPair {
  /** JWT для заголовка `Authorization: Bearer`. Живёт минуты. */
  accessToken: string
  accessTokenExpiresInSeconds: number
  /**
   * Непрозрачная строка, НЕ JWT. Разбирать её нельзя и незачем; предъявляется только
   * в `/api/auth/refresh` и `/api/auth/logout`.
   */
  refreshToken: string
  /**
   * Остаток срока refresh-токена. Он же таймаут по бездействию: срок сдвигается при
   * каждом успешном продлении.
   */
  refreshTokenExpiresInSeconds: number
  user: CurrentUser
}

export interface LoginRequest {
  login: string
  password: string
}

/** Формат ошибки, общий для всего API webbuh. */
export interface ApiErrorBody {
  timestamp: string
  status: number
  error: string
  message: string
  path: string
}
