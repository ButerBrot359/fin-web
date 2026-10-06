/**
 * Разбор отказов по правам доступа (SCRUM-400, ADR-0088 §2.5).
 *
 * Предикат «отказ по правам» = статус 403 И машинный код `FORBIDDEN` либо
 * `ACCESS_DENIED` (переходный период: сейчас бэк шлёт `FORBIDDEN`, после
 * включения флага `response-code-enabled` придёт `ACCESS_DENIED` — фронт
 * обязан принимать оба без релиза). ДО предиката проверяются два исключения,
 * которые 403 по правам не являются:
 *  - обязательная смена пароля — тот же `FORBIDDEN`, различим только по
 *    точному message сервлет-фильтра (текст не переводится, всегда русский);
 *  - `ACCOUNT_INELIGIBLE` — учётная запись стала недействительной: сессия
 *    мертва, нужен экран входа, а не «Нет доступа».
 */

/** `TARGET` — нет права на ЦЕЛЬ действия (nav.*, ref.create/copy/open,
 * createBasedOn): форма цела, показывается только причина. `SESSION` — всё
 * остальное. Отсутствующее или неизвестное значение трактуется как SESSION. */
export type AccessDenialScope = 'TARGET' | 'SESSION'

/** Тело любой ошибки webbuh (`ErrorResponse`); `scope` — только у 403 по правам. */
export interface ApiErrorBody {
  timestamp: string
  status: number
  error: string
  message: string
  path: string
  scope?: AccessDenialScope
}

/** Коды отказа по правам. Других кодов у отказа по правам нет. */
const ACCESS_DENIED_CODES = new Set(['FORBIDDEN', 'ACCESS_DENIED'])

/**
 * Точный message фильтра обязательной смены пароля (`PasswordChangeRequiredFilter`).
 * Не переводится бэком даже при казахском Accept-Language — сравниваем с русской
 * строкой намеренно (раздел 4.3 спеки SCRUM-400).
 */
export const PASSWORD_CHANGE_REQUIRED_MESSAGE =
  'Требуется сменить пароль — остальные действия недоступны'

/** Код сервлет-фильтра «учётная запись недействительна» (глобальный ENFORCE). */
export const ACCOUNT_INELIGIBLE_CODE = 'ACCOUNT_INELIGIBLE'

export interface AccessDenialInfo {
  message: string | null
  scope: AccessDenialScope
}

export type AccessErrorKind =
  | { kind: 'password-change'; message: string }
  | { kind: 'account-ineligible'; message: string | null }
  | { kind: 'access-denied'; denial: AccessDenialInfo }

const normalizeScope = (raw: unknown): AccessDenialScope =>
  raw === 'TARGET' ? 'TARGET' : 'SESSION'

/**
 * Классификация 403 по статусу/коду/тексту — ядро, общее для REST
 * (`ApiHttpError.body`) и SDUI (`ViewHttpError.code/scope`). Порядок веток —
 * контрактный: исключения идут ДО общего предиката «отказ по правам».
 *
 * @returns null — это не 403 авторизации/прав (обычная ошибка, обрабатывается
 * как раньше).
 */
export function classifyAccessError(
  status: number | undefined,
  code: string | undefined,
  message: string | undefined,
  scope?: unknown
): AccessErrorKind | null {
  if (status !== 403 || !code) return null
  if (code === ACCOUNT_INELIGIBLE_CODE) {
    return { kind: 'account-ineligible', message: message ?? null }
  }
  if (code === 'FORBIDDEN' && message === PASSWORD_CHANGE_REQUIRED_MESSAGE) {
    return { kind: 'password-change', message }
  }
  if (ACCESS_DENIED_CODES.has(code)) {
    return {
      kind: 'access-denied',
      denial: { message: message ?? null, scope: normalizeScope(scope) },
    }
  }
  return null
}

/** Поля тела ошибки из произвольного JSON — на границе контракту не доверяем. */
export function readErrorBody(body: unknown): {
  code?: string
  message?: string
  scope?: unknown
} {
  if (!body || typeof body !== 'object') return {}
  const b = body as Record<string, unknown>
  return {
    code: typeof b.error === 'string' ? b.error : undefined,
    message: typeof b.message === 'string' ? b.message : undefined,
    scope: b.scope,
  }
}

/**
 * Тело ошибки, пришедшее Blob'ом (`responseType: 'blob'` у печати и выгрузок):
 * сервер отвечает JSON-ошибкой до первого байта файла, но axios уже отдал её
 * как Blob. null — это не JSON-ошибка (настоящий файл или не-Blob).
 */
export async function parseBlobErrorBody(data: unknown): Promise<unknown> {
  if (
    typeof Blob === 'undefined' ||
    !(data instanceof Blob) ||
    !data.type.includes('json')
  ) {
    return null
  }
  try {
    return JSON.parse(await data.text()) as unknown
  } catch {
    return null
  }
}
