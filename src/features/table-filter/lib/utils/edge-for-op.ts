import type { FilterOp } from '@/shared/lib/eav'

import type { DateEdge } from './normalize-date-value'

/**
 * Мэппинг оператор → edge дня для DATETIME-фильтра (date-only picker).
 *
 *   gte → start (`T00:00:00`) — с этой даты включительно
 *   gt  → end   (`T23:59:59`) — строго после этого дня (отгородить весь день)
 *   lte → end   (`T23:59:59`) — по эту дату включительно
 *   lt  → start (`T00:00:00`) — строго до этого дня (отгородить весь день)
 *   eq/ne скрыты для DATETIME (см. resolveAllowedOps); сюда они не приходят,
 *   но fallback на `start` безопасен.
 *
 * Логика: «строгое неравенство» отгораживает весь день полностью,
 *         «нестрогое» захватывает день с соответствующего края.
 */
export const getEdgeForOp = (op: FilterOp): DateEdge => {
  if (op === 'gt' || op === 'lte') return 'end'
  return 'start'
}
