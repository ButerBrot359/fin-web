/**
 * Коды раздела, зарезервированные под служебные страницы: под ними нет
 * сохранённого объекта, и запрос `GET /api/analytics/items/{code}` по ним не
 * уходит. Бэкенд эти коды при создании объектов не выдаёт.
 */
export const ANALYTICS_ASSISTANT_CODE = 'assistant'
export const ANALYTICS_SETTINGS_CODE = 'settings'

export const ANALYTICS_STATISTICS_CODE = 'ai-statistics'
