import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'

import { getAuditActions, type AuditActionOption } from '../api/audit-log-api'

/**
 * Запасной список событий — на случай, если сервер ещё не отдаёт `GET /api/audit/actions`
 * (бэкенд SCRUM-371 выкатывается отдельно) или отказал. Пары «код → ключ перевода» литералами:
 * ключи i18n типизированы, и шаблонную строку компилятор не проверил бы.
 */
const FALLBACK_ACTIONS = [
  ['CREATE', 'auditLog.actions.CREATE'],
  ['UPDATE', 'auditLog.actions.UPDATE'],
  ['POST', 'auditLog.actions.POST'],
  ['UNPOST', 'auditLog.actions.UNPOST'],
  ['DELETION_MARK', 'auditLog.actions.DELETION_MARK'],
  ['DELETE', 'auditLog.actions.DELETE'],
  ['LOGIN', 'auditLog.actions.LOGIN'],
  ['LOGOUT', 'auditLog.actions.LOGOUT'],
  ['SESSION_REFRESH', 'auditLog.actions.SESSION_REFRESH'],
  ['PASSWORD_CHANGED', 'auditLog.actions.PASSWORD_CHANGED'],
  ['LOGIN_SETTINGS_CHANGED', 'auditLog.actions.LOGIN_SETTINGS_CHANGED'],
] as const

/**
 * События для отбора. Основной источник — сервер: там и подписи, и группы («Сеанс», «Данные»,
 * «Запуск», «Администрирование», «Безопасность»), и новые события появятся без выпуска фронта.
 */
export const useAuditActions = (): AuditActionOption[] => {
  const { t } = useTranslation()
  const { data } = useQuery({
    queryKey: ['audit-log-actions'],
    queryFn: ({ signal }) => getAuditActions(signal),
    staleTime: Infinity,
    retry: false,
  })

  if (data && data.length > 0) return data
  return FALLBACK_ACTIONS.map(([code, labelKey]) => ({
    code,
    presentation: t(labelKey),
  }))
}
