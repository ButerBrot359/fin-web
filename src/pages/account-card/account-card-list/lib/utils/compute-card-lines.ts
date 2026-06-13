import {
  DEFAULT_ANALYTICS_GROUPS,
  type AccountCardEntry,
  type AccountCardTotals,
  type AnalyticsGroups,
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

/**
 * Список значений аналитики стороны (измерения + субконто) — построчно.
 * `groups` управляет видимостью переключаемых измерений/субконто (чекбоксы
 * группировки). Организация и КодПлатныхУслуг показываются всегда.
 */
export const analyticsList = (
  entry: AccountCardEntry,
  side: 'Dt' | 'Kt',
  groups: AnalyticsGroups = DEFAULT_ANALYTICS_GROUPS
): string[] => {
  const out: string[] = []
  if (entry.organizatsiya?.presentation)
    out.push(entry.organizatsiya.presentation)
  if (groups.podrazdelenie && entry.podrazdelenie?.presentation)
    out.push(entry.podrazdelenie.presentation)
  if (groups.fkr && entry.fkr?.presentation) out.push(entry.fkr.presentation)
  if (groups.spetsifika && entry.spetsifika?.presentation)
    out.push(entry.spetsifika.presentation)
  if (groups.istochnik && entry.istochnikFinansirovaniya?.presentation)
    out.push(entry.istochnikFinansirovaniya.presentation)
  if (entry.kodPlatnykhUslug?.presentation)
    out.push(entry.kodPlatnykhUslug.presentation)
  if (groups.subkonto) {
    const subs = side === 'Dt' ? entry.subkontosDt : entry.subkontosKt
    for (const s of subs ?? []) {
      const nm = s.displayName ?? s.nameRu ?? s.code
      if (nm) out.push(nm)
    }
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
