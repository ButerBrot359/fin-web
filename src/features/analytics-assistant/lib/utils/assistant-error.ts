/**
 * Разбор ошибок ассистента.
 *
 * `makeRequest` в `shared/api/api.ts` бросает ТЕЛО ответа, а не `AxiosError`:
 * HTTP-статуса здесь нет, различать случаи можно только по содержимому.
 * Поэтому вместо «unknown» показываем пользователю текст, пришедший с бэкенда.
 */

const TEXT_KEYS = ['message', 'error', 'detail', 'title', 'description']

/** Человекочитаемый текст изброшенного тела ответа (или `null`). */
export const extractErrorText = (error: unknown): string | null => {
  if (typeof error === 'string') return error || null
  if (error instanceof Error) return error.message || null
  if (error == null || typeof error !== 'object') return null

  const body = error as Record<string, unknown>
  for (const key of TEXT_KEYS) {
    const value = body[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return null
}

/**
 * Похоже ли, что доступ к ИИ просто не настроен (нет ключа, провайдера или
 * ассистент выключен) — тогда вместо текста ошибки ведём в «Настройки ИИ».
 */
const NO_AI_SETTINGS_RE =
  /ai[\s_-]?settings|не\s+настро|not\s+configured|api[\s_-]?key|апи[\s_-]?ключ|ключ\s+не\s+задан|провайдер\s+не|ассистент\s+(выключен|отключ)|assistant\s+is\s+disabled/i

export const isAiSettingsMissing = (text: string | null): boolean =>
  text != null && NO_AI_SETTINGS_RE.test(text)
