import type { AccountType } from '@/entities/account-plan'

/**
 * Строка Оборотно-сальдовой ведомости (ОСВ) — остатки и обороты по счёту
 * за период. Соответствует бэкендовому AccountingRegisterBalanceAndTurnoverDto
 * (виртуальная таблица 1С «ОстаткиИОбороты»).
 */
export interface OsvReportEntry {
  /** ID счёта (FK на AccountPlanEntry). */
  accountId?: number | null
  /** Код счёта (напр. «1010»). */
  accountCode?: string | null
  /** Наименование счёта (рус.). Бэк заполняет всегда; фолбэк — код. */
  accountNameRu?: string | null
  /** Характер счёта (А/П/АП). */
  accountType?: AccountType | null
  /** Сальдо на начало периода, Дт. */
  openingDt?: number | string | null
  /** Сальдо на начало периода, Кт. */
  openingKt?: number | string | null
  /** Оборот за период, Дт. */
  turnoverDt?: number | string | null
  /** Оборот за период, Кт. */
  turnoverKt?: number | string | null
  /** Сальдо на конец периода, Дт. */
  closingDt?: number | string | null
  /** Сальдо на конец периода, Кт. */
  closingKt?: number | string | null
}

/** Параметры запроса ОСВ. */
export interface OsvReportParams {
  /** Начало периода — ISO date-time. */
  from: string
  /** Конец периода — ISO date-time. */
  to: string
  /** Фильтр по счёту (опционально; пусто = все счета). */
  accountId?: number
}
