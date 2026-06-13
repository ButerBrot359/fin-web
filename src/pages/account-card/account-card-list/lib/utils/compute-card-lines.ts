import {
  subkontoGroupKey,
  type AccountCardEntry,
  type AccountCardTotals,
  type HiddenAnalyticsGroups,
  type RefOption,
} from '../../types/account-card'

const EMPTY_HIDDEN: HiddenAnalyticsGroups = new Set()

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
 * `hidden` — множество ключей скрытых групп (чекбоксы «Группировка»). Измерения
 * скрываются по ключу из `DIMENSION_GROUP_ITEMS`, субконто — по виду
 * (`subkonto:<kindRu>`). Пустое множество = показываем всё.
 */
export const analyticsList = (
  entry: AccountCardEntry,
  side: 'Dt' | 'Kt',
  hidden: HiddenAnalyticsGroups = EMPTY_HIDDEN
): string[] => {
  const out: string[] = []
  const dims: [string, RefOption | null | undefined][] = [
    ['organizatsiya', entry.organizatsiya],
    ['podrazdelenie', entry.podrazdelenie],
    ['fkr', entry.fkr],
    ['spetsifika', entry.spetsifika],
    ['istochnik', entry.istochnikFinansirovaniya],
    ['kodPlatnykhUslug', entry.kodPlatnykhUslug],
  ]
  for (const [key, d] of dims) {
    if (!hidden.has(key) && d?.presentation) out.push(d.presentation)
  }
  const subs = side === 'Dt' ? entry.subkontosDt : entry.subkontosKt
  for (const s of subs ?? []) {
    if (hidden.has(subkontoGroupKey(s.kindRu))) continue
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
