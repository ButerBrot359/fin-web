import { startOfMonth, startOfYear } from 'date-fns'
import type { DateView } from '@mui/x-date-pickers/models'

/**
 * Точность поля даты: наименьшая единица, которую пользователь вообще может
 * ввести. Выводится из формата, а не приходит отдельным ключом — бэк присылает
 * один `props.dateFormat`, и второй источник правды разошёлся бы с ним.
 */
export type DateGranularity = 'day' | 'month' | 'year'

export interface DateFormatSpec {
  granularity: DateGranularity
  /** Виды календаря: для «MM.yyyy» дня нет — его нельзя ни открыть, ни выбрать. */
  views: DateView[]
}

/**
 * Разбор `props.dateFormat` (формат date-fns, например «MM.yyyy»).
 *
 * Токены ищем по буквам date-fns: `d`/`D` — день, `M`/`L` — месяц. Литералы в
 * одинарных кавычках вырезаем перед разбором: в «MM.yyyy 'г.'» буква внутри
 * кавычек — текст, а не токен, и без вырезания «д» из «'дата'» включила бы
 * выбор дня.
 */
export function resolveDateFormatSpec(dateFormat: string): DateFormatSpec {
  const tokens = dateFormat.replace(/'[^']*'/g, '')

  if (/[dD]/.test(tokens)) {
    return { granularity: 'day', views: ['year', 'month', 'day'] }
  }
  if (/[ML]/.test(tokens)) {
    return { granularity: 'month', views: ['year', 'month'] }
  }
  return { granularity: 'year', views: ['year'] }
}

/**
 * Приведение выбранного значения к началу периода.
 *
 * На провод формат значения не меняется — уходит полная дата (ADR по DATE-полям:
 * `yyyy-MM-dd`). Недостающие разряды нельзя оставлять «как получилось»: в поле
 * «MM.yyyy» день не вводится, и MUI берёт его из текущего значения или сегодня.
 * Именно это и ломало «Месяц начисления»: пользователь выбирал месяц, на сервер
 * уезжало 12.08.2026, а проведение считало по началу месяца — введённый день
 * молча терялся. Выбран август 2026 → 2026-08-01.
 */
export function snapToGranularity(
  value: Date | null,
  granularity: DateGranularity
): Date | null {
  if (!value) return value
  switch (granularity) {
    case 'month':
      return startOfMonth(value)
    case 'year':
      return startOfYear(value)
    default:
      return value
  }
}
