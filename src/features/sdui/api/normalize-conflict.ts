import type { ConflictError } from '../types/view'

/**
 * Тело 409 с бэка несёт код конфликта в поле `error` (не `code`) — §2.6 спеки
 * SCRUM-244. Нормализуем на границе транспорта, чтобы conflict-handler и его
 * тесты остались на прежнем контракте. Фолбэк `code` удалён как мёртвый, и с
 * ним ушёл рассинхрон приоритета ключей с parse-view-error (SCRUM-366).
 */
export function normalizeConflictBody(body: unknown): ConflictError {
  const b = (body && typeof body === 'object' ? body : {}) as Record<
    string,
    unknown
  >
  const code = (typeof b.error === 'string' && b.error) || ''
  return {
    code,
    formSessionId:
      typeof b.formSessionId === 'string' ? b.formSessionId : undefined,
    currentRevision:
      typeof b.currentRevision === 'number' ? b.currentRevision : undefined,
    snapshot: b.snapshot as ConflictError['snapshot'],
    reason: typeof b.reason === 'string' ? b.reason : undefined,
    // SCRUM-330: OBJECT_LOCKED/LOCK_CONFLICT несут пользовательский текст в
    // стандартном поле message (имя объекта, владелец блокировки) — показываем как есть
    message: typeof b.message === 'string' ? b.message : undefined,
  }
}
