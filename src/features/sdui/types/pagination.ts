// Контракт больших таблиц (SCRUM-368, v2-back §3/§6): props.pagination и
// props.virtualization на нодах TABLE / LIST / REPORT_RESULT. Все поля
// опциональны — отсутствие pagination = INLINE (текущее поведение).

export interface PaginationSource {
  url: string
  method?: 'GET' | 'POST'
  body?: Record<string, unknown> | null
  params?: Record<string, string>
}

export type PaginationMode = 'INLINE' | 'PAGED'

export type PaginationLoadTrigger = 'INFINITE_SCROLL' | 'SHOW_MORE' | 'PAGER'

export interface PaginationConfig {
  mode: PaginationMode
  // Только для PAGED; дефолт INFINITE_SCROLL
  loadTrigger?: PaginationLoadTrigger
  // Задаёт бэк; фронт ничего не хардкодит (фолбэки — только для старых ответов)
  pageSize?: number
  // Обязателен при mode=PAGED; фронт ходит по нему с page (0-based) и size
  source?: PaginationSource
}

// AUTO (дефолт) — фронтовая эвристика по числу строк; ON/OFF — форс с бэка
// для таблиц-исключений (в норме бэк это поле не шлёт).
export type VirtualizationOverride = 'AUTO' | 'ON' | 'OFF'
