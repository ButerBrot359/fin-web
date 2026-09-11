/**
 * Коды раздела, зарезервированные под служебные страницы: под ними нет
 * сохранённого объекта, и запрос `GET /api/analytics/items/{code}` по ним не
 * уходит. Бэкенд эти коды при создании объектов не выдаёт.
 */
export const ANALYTICS_ASSISTANT_CODE = 'assistant'
export const ANALYTICS_SETTINGS_CODE = 'settings'

export const ANALYTICS_STATISTICS_CODE = 'ai-statistics'

export const ANALYTICS_DASHBOARD_ASSISTANT_CODE = 'assistant-dashboards'
export const ANALYTICS_REPORT_ASSISTANT_CODE = 'assistant-reports'

export const ANALYTICS_DICTIONARY_PERMISSIONS_CODE = 'dictionary-permissions'
