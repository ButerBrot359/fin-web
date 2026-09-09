import type { CalendarDayKind } from './calendar-types'

/**
 * Синтетический код чипа «Выходной» (v12 §3.7): существует только как ключ
 * легенды, на провод не уходит и в командах не участвует.
 */
export const WEEKEND_LEGEND_CODE = 'Vykhodnoy'

const WEEKEND_WIRE_CODES = new Set(['Subbota', 'Voskresene'])

/**
 * Проекция dayKinds для легенды (v12 §3): «Суббота» и «Воскресенье» сливаются
 * в один чип «Выходной» на позиции субботы. Исходный массив не мутируется —
 * меню «Изменить день» обязано получать полный набор из семи видов (§3.6).
 */
export function collapseWeekendKinds(
  dayKinds: CalendarDayKind[],
  weekendTitle: string
): CalendarDayKind[] {
  const result: CalendarDayKind[] = []
  let inserted = false
  for (const kind of dayKinds) {
    if (!WEEKEND_WIRE_CODES.has(kind.code)) {
      result.push(kind)
      continue
    }
    if (!inserted) {
      result.push({ code: WEEKEND_LEGEND_CODE, title: weekendTitle })
      inserted = true
    }
  }
  return result
}
