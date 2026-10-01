import { toIsoDate } from './iso-date'

interface DateParamMeta {
  code: string
  dataType: string
}

interface PeriodBounds {
  from: string
  to: string
}

const normalizeDate = (raw: string): string =>
  raw ? (toIsoDate(raw) ?? raw) : raw

export const normalizeBodyDates = (
  parameters: Record<string, unknown>,
  metaParams: DateParamMeta[]
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...parameters }
  for (const p of metaParams) {
    if (p.dataType === 'DATE') {
      const v = out[p.code]
      if (typeof v === 'string' && v) out[p.code] = normalizeDate(v)
      continue
    }
    if (p.dataType !== 'PERIOD') continue
    const v = out[p.code] as PeriodBounds | undefined
    if (v && typeof v === 'object') {
      out[p.code] = {
        ...v,
        from: normalizeDate(v.from),
        to: normalizeDate(v.to),
      }
    }
  }
  return out
}
