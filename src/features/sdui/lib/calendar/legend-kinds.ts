import type { CalendarDayKind, CalendarDayKindDay } from './calendar-types'

/**
 * SCRUM-277 v13 §3 / v15 §3.1: чипы «Суббота» и «Воскресенье» присутствуют в
 * легенде тогда и только тогда, когда в отображаемом году есть хотя бы один
 * день соответствующего вида. Явное множество, а не условие «вида нет в году»
 * поверх всего списка: новый вид, добавленный в перечисление 1С, не должен
 * молча попасть под фильтр, которого для него не согласовывали.
 */
const FILTERED_BY_PRESENCE = new Set(['Subbota', 'Voskresene'])

/**
 * Проекция dayKinds для легенды. Остальные пять видов показываются всегда,
 * даже при нуле дней в году (v15 §4.1). Исходный массив не мутируется — меню
 * «Изменить день» обязано получать полный набор из семи видов (§3.3).
 */
export function filterLegendKinds(
  dayKinds: CalendarDayKind[],
  days: readonly Pick<CalendarDayKindDay, 'kind'>[] | undefined
): CalendarDayKind[] {
  const present = new Set<string>()
  for (const day of days ?? []) {
    if (day.kind) present.add(day.kind)
  }
  return dayKinds.filter(
    (kind) => !FILTERED_BY_PRESENCE.has(kind.code) || present.has(kind.code)
  )
}
