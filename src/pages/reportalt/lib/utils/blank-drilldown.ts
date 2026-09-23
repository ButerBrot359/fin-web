import { DRILLDOWN_URL_KEY } from '@/entities/report-drilldown'

/**
 * Расшифровка клетки утверждённого бланка.
 *
 * <p>В 1С «Расшифровать» работает не по строке результата, а по имени области активной клетки:
 * `КодФормы = Сред(ИмяЯчейки,3,6)` определяет форму, последняя цифра — графу. Графы 1–3 это
 * месяцы отчётного квартала, графа 4 — квартал целиком; открывается регистр налогового учёта по
 * ИПН и СН за этот период (`Форма200Расшифровка` и `Форма200_01Расшифровка` эталона).
 */
export interface BlankDrilldownTarget {
  reportCode: string
  params: URLSearchParams
}

const REGISTR_IPN_SN = 'RegistrNalogovogoUchetaPoIPNiSN'

/** Формы, у которых расшифровка клетки ведёт в регистр налогового учёта. */
const FORMY_REGISTRA = ['200_00', '200_01']

const OBLAST_KLETKI = /^s_(\d{3}_\d{2})_\d{3}_([1-4])$/

const dobavitMesyatsy = (iso: string, mesyatsev: number): Date => {
  const [god, mesyats, den] = iso.split('-').map(Number)
  return new Date(Date.UTC(god, mesyats - 1 + mesyatsev, den))
}

const konetsMesyatsa = (data: Date): Date =>
  new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 1, 0))

const iso = (data: Date): string => data.toISOString().slice(0, 10)

/**
 * Период расшифровки по графе клетки: 1–3 — соответствующий месяц квартала, 4 — весь период.
 */
export const periodRasshifrovki = (
  grafa: string,
  from: string,
  to: string
): { from: string; to: string } => {
  if (grafa === '4') return { from, to }
  const nachalo = dobavitMesyatsy(from, Number(grafa) - 1)
  return { from: iso(nachalo), to: iso(konetsMesyatsa(nachalo)) }
}

/**
 * Куда ведёт расшифровка выделенной клетки бланка; `null` — клетка не расшифровывается.
 */
export const rasshifrovkaKletki = (
  oblast: string | null | undefined,
  organizatsiyaId: number | null | undefined,
  period: { from: string; to: string } | null | undefined
): BlankDrilldownTarget | null => {
  if (!oblast || !period?.from || !period.to) return null
  const razobrano = OBLAST_KLETKI.exec(oblast)
  if (!razobrano || !FORMY_REGISTRA.includes(razobrano[1])) return null

  const params = new URLSearchParams()
  params.set(DRILLDOWN_URL_KEY, '1')
  params.set(
    'Period',
    JSON.stringify(periodRasshifrovki(razobrano[2], period.from, period.to))
  )
  if (organizatsiyaId != null) {
    params.set('Organizatsiya', String(organizatsiyaId))
  }
  return { reportCode: REGISTR_IPN_SN, params }
}
