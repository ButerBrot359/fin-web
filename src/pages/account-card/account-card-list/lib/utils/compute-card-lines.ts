import type { AccountCardEntry } from '../../types/account-card'

export interface CardLine {
  entry: AccountCardEntry
  debit: number
  credit: number
  debitQty: number
  creditQty: number
  /** Накопительное текущее сальдо после этой проводки. */
  balance: number
}

export interface CardComputed {
  lines: CardLine[]
  totalDt: number
  totalKt: number
  closing: number
}

/** Список значений аналитики стороны (измерения + субконто) — построчно. */
export const analyticsList = (
  entry: AccountCardEntry,
  side: 'Dt' | 'Kt'
): string[] => {
  const out: string[] = []
  const dims = [
    entry.organizatsiya,
    entry.podrazdelenie,
    entry.fkr,
    entry.spetsifika,
    entry.istochnikFinansirovaniya,
    entry.kodPlatnykhUslug,
  ]
  for (const d of dims) if (d?.presentation) out.push(d.presentation)
  const subs = side === 'Dt' ? entry.subkontosDt : entry.subkontosKt
  for (const s of subs ?? []) {
    const nm = s.displayName ?? s.nameRu ?? s.code
    if (nm) out.push(nm)
  }
  return out
}

export const toNum = (v: number | string | null | undefined): number => {
  if (v == null || v === '') return 0
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isNaN(n) ? 0 : n
}

/**
 * Расчёт строк карточки счёта: для каждой проводки определяем сторону счёта
 * карточки (Дт → приход, Кт → расход), накапливаем текущее сальдо
 * (предыдущее + Дт − Кт) и считаем обороты + конечное сальдо.
 */
export const computeCardLines = (
  rows: AccountCardEntry[],
  opening: number,
  cardCode: string
): CardComputed => {
  const sorted = [...rows].sort((a, b) =>
    (a.period ?? '').localeCompare(b.period ?? '')
  )
  let running = opening
  let totalDt = 0
  let totalKt = 0
  const lines: CardLine[] = sorted.map((entry) => {
    const summa = toNum(entry.summa)
    let debit = 0
    let credit = 0
    let debitQty = 0
    let creditQty = 0
    if (entry.accountKtCode === cardCode && entry.accountDtCode !== cardCode) {
      credit = summa
      creditQty = toNum(entry.kolichestvoKt)
      running -= summa
      totalKt += summa
    } else {
      debit = summa
      debitQty = toNum(entry.kolichestvoDt)
      running += summa
      totalDt += summa
    }
    return { entry, debit, credit, debitQty, creditQty, balance: running }
  })
  return { lines, totalDt, totalKt, closing: opening + totalDt - totalKt }
}
