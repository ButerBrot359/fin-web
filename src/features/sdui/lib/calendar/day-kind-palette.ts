import type { CalendarDayKind } from './calendar-types'

// Палитра видов дня производственного календаря (mode=dayKind). Состав видов
// приходит с бэка (props.dayKinds) и фронту семантически непрозрачен — цвет
// назначается по ИНДЕКСУ вида в списке, легенда рисует то же соответствие.
const DAY_KIND_CLASSES = [
  'bg-blue-100 text-blue-800',
  'bg-gray-200 text-gray-600',
  'bg-red-100 text-red-700',
  'bg-amber-100 text-amber-800',
  'bg-green-100 text-green-800',
  'bg-purple-100 text-purple-800',
]

/** kind не найден/не задан (год не заполнен) — нейтральная ячейка. */
export const DAY_KIND_EMPTY_CLASS = 'text-gray-400'

export function dayKindClass(
  dayKinds: CalendarDayKind[],
  kind: string | null | undefined
): string {
  if (!kind) return DAY_KIND_EMPTY_CLASS
  const idx = dayKinds.findIndex((k) => k.code === kind)
  if (idx < 0) return DAY_KIND_EMPTY_CLASS
  return DAY_KIND_CLASSES[idx % DAY_KIND_CLASSES.length]
}
