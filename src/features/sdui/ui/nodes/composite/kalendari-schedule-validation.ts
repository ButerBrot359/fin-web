import type { DayInterval } from './kalendari-schedule-summary'

export type IntervalErrorKey =
  | 'sdui.kalendari.errInvalidTime'
  | 'sdui.kalendari.errEndBeforeStart'
  | 'sdui.kalendari.errOverlap'

const HH_MM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const minutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':')
  return Number(h) * 60 + Number(m)
}

/**
 * Локальная проверка черновика интервалов дня перед Apply (spec v3):
 * формат ЧЧ:ММ, конец строго больше начала, без пересечений между
 * интервалами. Смежные интервалы (стык 12:00/12:00) валидны.
 * Возвращает i18n-ключ первой ошибки или null.
 */
export function validateIntervals(
  intervals: DayInterval[]
): IntervalErrorKey | null {
  for (const i of intervals) {
    if (!HH_MM_RE.test(i.start) || !HH_MM_RE.test(i.end)) {
      return 'sdui.kalendari.errInvalidTime'
    }
    if (minutes(i.end) <= minutes(i.start)) {
      return 'sdui.kalendari.errEndBeforeStart'
    }
  }
  const sorted = [...intervals].sort(
    (a, b) => minutes(a.start) - minutes(b.start)
  )
  for (let k = 1; k < sorted.length; k++) {
    if (minutes(sorted[k].start) < minutes(sorted[k - 1].end)) {
      return 'sdui.kalendari.errOverlap'
    }
  }
  return null
}
