import i18n from 'i18next'

import type { ApiConflictError } from '@/shared/api/api-error'

/**
 * Текст warning-тоста для 409 (SCRUM-330): бэкенд обычно присылает готовое
 * `message` («кем занято») — показываем как есть; на пустое тело — i18n-фолбэк
 * по коду конфликта (ключи `apiConflict.*`, по образцу SDUI conflict-handler).
 */
export const getConflictErrorMessage = (error: ApiConflictError): string => {
  if (error.message) return error.message
  return error.code === 'LOCK_CONFLICT'
    ? i18n.t('apiConflict.lockConflict')
    : i18n.t('apiConflict.objectLocked')
}
