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

// SCRUM-277 §5.1: семь известных видов производственного календаря получают
// стабильные семантические цвета (не зависящие от порядка в списке бэка).
// Неизвестный код по-прежнему красится по индексу — состав видов расширяем.
const KNOWN_KIND_CLASSES: Record<string, string> = {
  Rabochiy: 'bg-blue-100 text-blue-800',
  Subbota: 'bg-gray-200 text-gray-600',
  Voskresene: 'bg-red-100 text-red-700',
  DopolnitelnyyVykhodnoy: 'bg-purple-100 text-purple-800',
  Predprazdnichnyy: 'bg-amber-100 text-amber-800',
  Prazdnik: 'bg-red-200 text-red-800',
  Nerabochiy: 'bg-gray-400 text-gray-800',
}

/** kind не найден/не задан (год не заполнен) — нейтральная ячейка. */
export const DAY_KIND_EMPTY_CLASS = 'text-gray-400'

export function dayKindClass(
  dayKinds: CalendarDayKind[],
  kind: string | null | undefined
): string {
  if (!kind) return DAY_KIND_EMPTY_CLASS
  const known = KNOWN_KIND_CLASSES[kind]
  if (known) return known
  const idx = dayKinds.findIndex((k) => k.code === kind)
  if (idx < 0) return DAY_KIND_EMPTY_CLASS
  return DAY_KIND_CLASSES[idx % DAY_KIND_CLASSES.length]
}
