import type { NetworkHop } from '@/entities/network-chain'
import { apiService } from '@/shared/api/api'

/**
 * Запись журнала регистрации — поля из `AuditLogDto` бэкенда
 * (docs/project/frontend-handoff-SCRUM-371-zhurnal-registratsii.md §2).
 *
 * Почти всё необязательно, и это не дефект данных: у событий входа и выхода нет объекта
 * (`domainKind`/`entryId`/`typeCode`), а у неудачного входа может не быть `userEntryId` —
 * учётной записи с введённым логином может не существовать вовсе.
 *
 * Поля «откуда» (компьютер, адреса, сеанс, рабочий сервер, приложение) добавлены SCRUM-371 и
 * бэкенд отдаёт их не сразу — поэтому они необязательные: отсутствие показывается «—».
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
  /** Внешний адрес (роутер/NAT). */
  clientPublicIp?: string | null
  /** Адрес(а) компьютера в локальной сети со слов браузера, через запятую. */
  clientLocalIp?: string | null
  networkChain?: NetworkHop[] | null
  deviceId?: string | null
  /** Готовое представление компьютера (имя, заданное пользователем, или метка устройства). */
  computer?: string | null
  serverNode?: string | null
  sessionId?: string | null
  application?: string | null
  applicationPresentation?: string | null
  /** Представление метаданных («Документ. Платёжное поручение»). */
  typePresentation?: string | null
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
  actions?: string[]
  outcome?: string
  domainKind?: string
  typeCode?: string
  entryId?: string
  ip?: string
  sessionId?: string
  deviceId?: string
  serverNode?: string
  application?: string
  search?: string
  page: number
  size: number
}

/** Событие журнала для отбора: код, подпись и группа («Сеанс», «Данные», …). */
export interface AuditActionOption {
  code: string
  presentation: string
  group?: string | null
  groupPresentation?: string | null
}

const TEXT_FILTERS = [
  'userLogin',
  'outcome',
  'domainKind',
  'typeCode',
  'entryId',
  'ip',
  'sessionId',
  'deviceId',
  'serverNode',
  'application',
  'search',
] as const

/**
 * Параметры запроса ленты. Пустые отборы не отправляются вовсе: сервер трактует переданный пустой
 * параметр как значение, а не как «не фильтровать».
 *
 * События уходят списком через запятую в `actions` — Spring разбирает такую строку в список сам.
 * Если выбрано ровно одно событие, дублируется и старый одиночный `action`: бэкенд, ещё не
 * знающий `actions`, иначе молча показал бы всё подряд.
 */
export const buildAuditLogParams = (
  query: AuditLogQuery
): Record<string, string | number> => {
  const params: Record<string, string | number> = {
    page: query.page,
    size: query.size,
  }
  if (query.from) params.from = query.from
  if (query.to) params.to = query.to
  for (const key of TEXT_FILTERS) {
    const value = query[key]?.trim()
    if (value) params[key] = value
  }
  const actions = (query.actions ?? []).filter(Boolean)
  if (actions.length > 0) params.actions = actions.join(',')
  if (actions.length === 1) params.action = actions[0]
  return params
}

/** Лента журнала с отборами. */
export const getAuditLog = async (
  query: AuditLogQuery
): Promise<AuditLogPage> => {
  const response = await apiService.get<AuditLogPage>({
    url: '/api/audit',
    params: buildAuditLogParams(query),
  })
  return response.data
}

/** Одна запись журнала — для карточки события. */
export const getAuditLogRecord = async (
  id: number,
  signal?: AbortSignal
): Promise<AuditLogRecord> => {
  const response = await apiService.get<AuditLogRecord>({
    url: `/api/audit/${String(id)}`,
    signal,
  })
  return response.data
}

/** Справочник событий для отбора, сгруппированный как в 1С. */
export const getAuditActions = async (
  signal?: AbortSignal
): Promise<AuditActionOption[]> => {
  const response = await apiService.get<AuditActionOption[]>({
    url: '/api/audit/actions',
    signal,
  })
  return Array.isArray(response.data) ? response.data : []
}
