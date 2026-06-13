import type {
  AccountCardEntry,
  AccountCardTotals,
} from '../../types/account-card'

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
 * Строки карточки счёта. Вся учётная математика (сторона Дт/Кт, накопительное
 * текущее сальдо, корр-счёт, обороты, конечное сальдо) считается на БЭКЕ — фронт
 * только переносит готовые серверные поля в строки таблицы (принцип «логика на
 * сервере, фронт рендерит»). Порядок движений задаёт сервер (по периоду/lineNo),
 * поэтому здесь НЕ сортируем. Итоги берутся из серверных агрегатов `totals`.
 */
export const computeCardLines = (
  rows: AccountCardEntry[],
  totals?: AccountCardTotals | null
): CardComputed => {
  const lines: CardLine[] = rows.map((entry) => ({
    entry,
    debit: toNum(entry.debit),
    credit: toNum(entry.credit),
    debitQty: toNum(entry.debitKolichestvo),
    creditQty: toNum(entry.creditKolichestvo),
    balance: toNum(entry.runningBalance),
  }))
  return {
    lines,
    totalDt: totals ? totals.turnoverDt : 0,
    totalKt: totals ? totals.turnoverKt : 0,
    closing: totals ? totals.closingBalance : 0,
  }
}
