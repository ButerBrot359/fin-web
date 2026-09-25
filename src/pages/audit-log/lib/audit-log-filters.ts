import type { AuditLogQuery } from '../api/audit-log-api'

/**
 * Отбор журнала регистрации — в том виде, в каком его правит пользователь (строки полей ввода).
 * Живёт в адресной строке: «Назад» после перехода в объект возвращает тот же отбор, а быстрые
 * отборы из карточки события («все события этого сеанса») — это просто новый адрес.
 */
export interface AuditLogFilterValues {
  /** `datetime-local`: `2026-09-08T10:00`. */
  from: string
  to: string
  userLogin: string
  actions: string[]
  outcome: string
  domainKind: string
  typeCode: string
  entryId: string
  ip: string
  sessionId: string
  deviceId: string
  serverNode: string
  application: string
  search: string
}

type TextFilterKey = Exclude<keyof AuditLogFilterValues, 'actions'>

const TEXT_KEYS: readonly TextFilterKey[] = [
  'from',
  'to',
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
]

/** Отборы второго ряда («Ещё отборы»): по ним видно, раскрывать ли панель сразу. */
export const EXTRA_FILTER_KEYS: readonly TextFilterKey[] = [
  'domainKind',
  'typeCode',
  'entryId',
  'ip',
  'sessionId',
  'deviceId',
  'serverNode',
  'application',
]

export const EMPTY_FILTERS: AuditLogFilterValues = {
  from: '',
  to: '',
  userLogin: '',
  actions: [],
  outcome: '',
  domainKind: '',
  typeCode: '',
  entryId: '',
  ip: '',
  sessionId: '',
  deviceId: '',
  serverNode: '',
  application: '',
  search: '',
}

const PAGE_PARAM = 'page'

export const filtersFromSearchParams = (
  params: URLSearchParams
): { filters: AuditLogFilterValues; page: number } => {
  const filters: AuditLogFilterValues = { ...EMPTY_FILTERS }
  for (const key of TEXT_KEYS) {
    filters[key] = params.get(key) ?? ''
  }
  filters.actions = (params.get('actions') ?? '')
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean)
  const page = Number(params.get(PAGE_PARAM))
  return {
    filters,
    page: Number.isInteger(page) && page > 0 ? page : 0,
  }
}

export const filtersToSearchParams = (
  filters: AuditLogFilterValues,
  page = 0
): URLSearchParams => {
  const params = new URLSearchParams()
  for (const key of TEXT_KEYS) {
    const value = filters[key].trim()
    if (value) params.set(key, value)
  }
  if (filters.actions.length > 0) {
    params.set('actions', filters.actions.join(','))
  }
  if (page > 0) params.set(PAGE_PARAM, String(page))
  return params
}

/** `datetime-local` отдаёт минуты без секунд, сервер ждёт полный `LocalDateTime`. */
const toLocalDateTime = (value: string): string | undefined => {
  if (!value) return undefined
  return value.length === 16 ? `${value}:00` : value
}

export const filtersToQuery = (
  filters: AuditLogFilterValues,
  page: number,
  size: number
): AuditLogQuery => ({
  ...filters,
  from: toLocalDateTime(filters.from),
  to: toLocalDateTime(filters.to),
  page,
  size,
})

export const countExtraFilters = (filters: AuditLogFilterValues): number =>
  EXTRA_FILTER_KEYS.filter((key) => filters[key].trim() !== '').length
