import type { AnalyticsParameter } from '@/entities/analytics'

/**
 * Заполнено ли значение параметра. Пустая строка, пустой массив и объект с
 * незаполненной частью (например, `DATE_RANGE` только с началом периода)
 * считаются незаполненными.
 */
const isFilled = (value: unknown): boolean => {
  if (value == null) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') {
    const parts = Object.values(value as Record<string, unknown>)
    return parts.length > 0 && parts.every(isFilled)
  }
  return true
}

/**
 * Все ли обязательные параметры заполнены. Пока нет — запросы датасетов не
 * запускаем: без параметров SQL всё равно вернёт ошибку.
 *
 * Живёт в слайсе дашборда, отчёт импортирует отсюда же — правило одно на оба
 * контура, дублировать его нельзя.
 */
export const areRequiredParamsFilled = (
  parameters: AnalyticsParameter[],
  values: Record<string, unknown>
): boolean =>
  parameters
    .filter((parameter) => parameter.required)
    .every((parameter) => isFilled(values[parameter.code]))
