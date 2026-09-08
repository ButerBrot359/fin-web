import type { AnalyticsParameter } from '@/entities/analytics'

import type { AnalyticsParamValues } from '../types/params'
import { toDateRange, toIsoDate } from './resolve-default-params'

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || value === '') return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Готовит значения панели к отправке на бэкенд:
 * - DATE_RANGE с кодом `period` разворачивается в `period_from` / `period_to`;
 * - даты сериализуются в `yyyy-MM-dd`;
 * - пустые значения уходят как `null`, а не как пустая строка.
 */
export const expandParams = (
  parameters: AnalyticsParameter[],
  values: AnalyticsParamValues
): Record<string, unknown> => {
  const expanded: Record<string, unknown> = {}

  parameters.forEach((parameter) => {
    const raw = values[parameter.code]
    switch (parameter.type) {
      case 'DATE_RANGE': {
        const range = toDateRange(raw)
        expanded[`${parameter.code}_from`] = range.from
        expanded[`${parameter.code}_to`] = range.to
        break
      }
      case 'DATE':
        expanded[parameter.code] = toIsoDate(raw)
        break
      case 'BOOLEAN':
        expanded[parameter.code] = raw == null ? null : Boolean(raw)
        break
      case 'INTEGER':
      case 'DECIMAL':
        expanded[parameter.code] = toNumber(raw)
        break
      default:
        expanded[parameter.code] = raw == null || raw === '' ? null : raw
    }
  })

  return expanded
}
