import { apiService } from '@/shared/api/api'

/**
 * Запись журнала регистрации — поля из `AuditLogDto` бэкенда
 * (docs/project/frontend-handoff-SCRUM-371-zhurnal-registratsii.md §2).
 *
 * Почти всё необязательно, и это не дефект данных: у событий входа и выхода нет объекта
 * (`domainKind`/`entryId`/`typeCode`), а у неудачного входа может не быть `userEntryId` —
 * учётной записи с введённым логином может не существовать вовсе.
 */
export interface AuditLogRecord {
  id: number
  occurredAt: string
  action: string
  actionPresentation: string
  outcome: string
  outcomePresentation: string
  domainKind: string | null
  entryId: number | null
  typeCode: string | null
  entryPresentation: string | null
  userEntryId: number | null
  userLogin: string | null
  userName: string | null
  userIin: string | null
  clientAddress: string | null
  userAgent: string | null
  taskId: string | null
  message: string | null
  changes: string | null
}

/** Страница Spring Data. Фронт ориентируется на ФАКТИЧЕСКИЕ size/totalPages, а не на запрошенные. */
export interface AuditLogPage {
  content: AuditLogRecord[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface AuditLogQuery {
  from?: string
  to?: string
  userLogin?: string
  action?: string
  outcome?: string
  page: number
  size: number
}

/**
 * Лента журнала. Пустые отборы не отправляются вовсе: сервер трактует переданный пустой параметр
 * как значение, а не как «не фильтровать».
 */
export const getAuditLog = async (
  query: AuditLogQuery
): Promise<AuditLogPage> => {
  const params: Record<string, string | number> = {
    page: query.page,
    size: query.size,
  }
  if (query.from) params.from = query.from
  if (query.to) params.to = query.to
  if (query.userLogin?.trim()) params.userLogin = query.userLogin.trim()
  if (query.action) params.action = query.action
  if (query.outcome) params.outcome = query.outcome

  const response = await apiService.get<AuditLogPage>({
    url: '/api/audit',
    params,
  })
  return response.data
}
