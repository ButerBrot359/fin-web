export interface PartialDateSection {
  type: string
  value: string
  contentType: string
}

const DATE_PARTS = ['day', 'month', 'year']
const TIME_PARTS = ['hours', 'minutes', 'seconds']

const readNumber = (section: PartialDateSection | undefined): number | null => {
  if (!section || section.value === '') return null
  if (section.contentType !== 'digit') return Number.NaN
  const parsed = Number(section.value)
  return Number.isInteger(parsed) ? parsed : Number.NaN
}

export function completePartialDate(
  sections: PartialDateSection[],
  today: Date
): Date | null {
  const dateSections = sections.filter((s) => DATE_PARTS.includes(s.type))
  if (dateSections.length === 0) return null

  const filledCount = dateSections.findIndex((s) => s.value === '')
  if (filledCount === 0) return null
  if (filledCount === -1 && sections.every((s) => s.value !== '')) return null
  if (
    filledCount > 0 &&
    dateSections.slice(filledCount).some((s) => s.value !== '')
  ) {
    return null
  }

  const byType = (type: string) => sections.find((s) => s.type === type)
  const hasSection = (type: string) => byType(type) !== undefined

  const day = readNumber(byType('day'))
  const month = readNumber(byType('month'))
  const year = readNumber(byType('year'))
  const [hours, minutes, seconds] = TIME_PARTS.map((t) => readNumber(byType(t)))

  const values = [day, month, year, hours, minutes, seconds]
  if (values.some((v) => Number.isNaN(v))) return null

  const resolvedYear = year ?? today.getFullYear()
  const resolvedMonth = month ?? (hasSection('month') ? today.getMonth() + 1 : 1)
  const resolvedDay = day ?? (hasSection('day') ? today.getDate() : 1)

  const result = new Date(
    resolvedYear,
    resolvedMonth - 1,
    resolvedDay,
    hours ?? 0,
    minutes ?? 0,
    seconds ?? 0
  )
  if (resolvedYear < 100) result.setFullYear(resolvedYear)

  const matches =
    result.getFullYear() === resolvedYear &&
    result.getMonth() === resolvedMonth - 1 &&
    result.getDate() === resolvedDay
  return matches ? result : null
}
