export interface ScheduleRow {
  rowId: string
  NomerDnya?: number
  VremyaNachala?: unknown
  VremyaOkonchaniya?: unknown
}

export interface DayInterval {
  start: string
  end: string
}

export interface DaySummary {
  hours: number
  intervals: DayInterval[]
}

// Провод — datetime с синтетической датой (spec v3): значима только часть HH:mm.
// Парсим срезом строки, не через new Date — чтобы не зависеть от таймзоны.
const WIRE_DATE_PREFIX = '2000-01-01T'
const WIRE_TIME_RE = /T(\d{2}:\d{2})/

/** `2000-01-01T09:00:00` → `09:00`; всё нераспознанное → null. */
export function formatWireTime(wire: unknown): string | null {
  if (typeof wire !== 'string') return null
  return WIRE_TIME_RE.exec(wire)?.[1] ?? null
}

/** `09:00` → `2000-01-01T09:00:00` (формат провода из spec v3). */
export function toWireTime(hhmm: string): string {
  return `${WIRE_DATE_PREFIX}${hhmm}:00`
}

const minutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':')
  return Number(h) * 60 + Number(m)
}

/** Часы интервала с округлением до 1 знака (spec v3: округлять на интервал). */
const intervalHours = (i: DayInterval): number =>
  Math.round(((minutes(i.end) - minutes(i.start)) / 60) * 10) / 10

/**
 * Саммари рабочего времени дня `day` по полному массиву RaspisanieRaboty:
 * только валидные интервалы этого дня (оба времени распознаны, конец > начала),
 * сортировка по началу, часы — сумма покруглённых по-интервально значений.
 * Нет валидных интервалов → null (в UI — «Заполнить расписание»).
 */
export function summarizeDay(
  rows: ScheduleRow[],
  day: number
): DaySummary | null {
  const intervals: DayInterval[] = []
  for (const r of rows) {
    if (r.NomerDnya !== day) continue
    const start = formatWireTime(r.VremyaNachala)
    const end = formatWireTime(r.VremyaOkonchaniya)
    if (!start || !end || minutes(end) <= minutes(start)) continue
    intervals.push({ start, end })
  }
  if (intervals.length === 0) return null
  intervals.sort((a, b) => minutes(a.start) - minutes(b.start))
  const hours = intervals.reduce((sum, i) => sum + intervalHours(i), 0)
  // Сумма покруглённых десятых может дать длинный хвост float — нормализуем.
  return { hours: Math.round(hours * 10) / 10, intervals }
}
