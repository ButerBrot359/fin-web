import { format, isValid } from 'date-fns'

/**
 * Сериализация значения дата-инпута для отправки на сервер (SCRUM-265 FE-6).
 *
 * `dateOnly` (DATE-поля): голая календарная дата `yyyy-MM-dd` в ЛОКАЛЬНОЙ зоне.
 * `toISOString()` уводил локальную полночь в UTC — для зоны восточнее Гринвича
 * «01.07 00:00 (+05:00)» превращалось в «2026-06-30T19:00:00.000Z», а сервер
 * (политика «offset отрезаем, не конвертируем») сохранял 30 июня. `format`
 * работает в локальной зоне — сдвига нет по построению.
 *
 * datetime-поля: политика UTC-на-проводе сохраняется — `toISOString()` как было.
 */
export function serializeDateInput(
  value: Date | null,
  dateOnly?: boolean
): string {
  if (!value || !isValid(value)) return ''
  return dateOnly ? format(value, 'yyyy-MM-dd') : value.toISOString()
}
