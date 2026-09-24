import { format, isValid, parseISO } from '@/shared/lib/utils/date'

import type { PeriodValue } from './params'

/** Код быстрого периода — он же ключ подписи в i18n (`reportalt.period.<code>`). */
export type PeriodPresetCode =
  | 'currentMonth'
  | 'previousMonth'
  | 'currentQuarter'
  | 'previousQuarter'
  | 'currentYear'
  | 'previousYear'

/** Порядок пунктов списка — от самого частого к редкому (месяц → квартал → год). */
export const PERIOD_PRESETS: PeriodPresetCode[] = [
  'currentMonth',
  'previousMonth',
  'currentQuarter',
  'previousQuarter',
  'currentYear',
  'previousYear',
]

export const KVARTALNYE_PRESETS: PeriodPresetCode[] = [
  'currentQuarter',
  'previousQuarter',
]

const day = (d: Date): string => format(d, 'yyyy-MM-dd')

/** Границы месяца, в который попадает `year`/`month` (month — 0-based, как в Date). */
const monthRange = (year: number, month: number): PeriodValue => ({
  from: day(new Date(year, month, 1)),
  to: day(new Date(year, month + 1, 0)),
})

/** Границы квартала по номеру месяца внутри него. */
const quarterRange = (year: number, month: number): PeriodValue => {
  const first = Math.floor(month / 3) * 3
  return {
    from: day(new Date(year, first, 1)),
    to: day(new Date(year, first + 3, 0)),
  }
}

const yearRange = (year: number): PeriodValue => ({
  from: day(new Date(year, 0, 1)),
  to: day(new Date(year, 11, 31)),
})

/**
 * Диапазон быстрого периода. `today` — точка отсчёта (параметр, а не `new Date()`
 * внутри: иначе функцию нельзя проверить тестом и она зависит от часа запуска).
 *
 * <p>Месяц и квартал считаются переходом через границу (`new Date(year, month + 1, 0)`
 * — последний день месяца), поэтому декабрь и високосный февраль отрабатывают сами,
 * без таблицы длин месяцев.
 */
export function periodPresetRange(
  code: PeriodPresetCode,
  today: Date = new Date()
): PeriodValue {
  const year = today.getFullYear()
  const month = today.getMonth()
  switch (code) {
    case 'currentMonth':
      return monthRange(year, month)
    case 'previousMonth':
      return monthRange(year, month - 1)
    case 'currentQuarter':
      return quarterRange(year, month)
    case 'previousQuarter':
      return quarterRange(year, month - 3)
    case 'currentYear':
      return yearRange(year)
    case 'previousYear':
      return yearRange(year - 1)
  }
}

export const kvartalDaty = (raw: string): PeriodValue | undefined => {
  const d = parseISO(raw)
  if (!isValid(d)) return undefined
  return quarterRange(d.getFullYear(), d.getMonth())
}

/**
 * Код пресета, которому в точности соответствует заданная пара дат, либо `undefined`
 * (произвольный период). Нужен, чтобы список показывал выбранный пункт, а не сбрасывался
 * в пустое значение после каждого ручного правки даты.
 */
export function matchPeriodPreset(
  period: PeriodValue | undefined,
  today: Date = new Date()
): PeriodPresetCode | undefined {
  if (!period?.from || !period.to) return undefined
  const from = toLocalDay(period.from)
  const to = toLocalDay(period.to)
  return PERIOD_PRESETS.find((code) => {
    const range = periodPresetRange(code, today)
    return range.from === from && range.to === to
  })
}

/**
 * Дата поля в `yyyy-MM-dd`. Инпут отдаёт ISO с `Z`, а пресеты считаются локальными
 * днями — без приведения совпадение не находилось бы никогда.
 */
function toLocalDay(raw: string): string {
  const d = parseISO(raw)
  return isValid(d) ? format(d, 'yyyy-MM-dd') : raw
}
