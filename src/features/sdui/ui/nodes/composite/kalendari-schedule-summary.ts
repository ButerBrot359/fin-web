interface ScheduleRow {
  rowId: string
  NomerDnya?: number
  VremyaNachala?: unknown
  VremyaOkonchaniya?: unknown
}

const MS_PER_HOUR = 3_600_000

/** Часы интервала (конец−начало); неполные/битые интервалы дают 0. */
function intervalHours(start: unknown, end: unknown): number {
  if (typeof start !== 'string' || typeof end !== 'string') return 0
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0
  return (b - a) / MS_PER_HOUR
}

/** Саммари расписания: суммарные часы всех интервалов и число уникальных дней. */
export function summarizeSchedule(rows: ScheduleRow[]): {
  totalHours: number
  dayCount: number
} {
  let totalHours = 0
  const days = new Set<number>()
  for (const r of rows) {
    totalHours += intervalHours(r.VremyaNachala, r.VremyaOkonchaniya)
    if (typeof r.NomerDnya === 'number') days.add(r.NomerDnya)
  }
  return { totalHours, dayCount: days.size }
}
