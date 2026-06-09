import type { AccountType } from '@/entities/account-plan'

/**
 * Описание аналитики (субконто) дочерней строки ОСВ.
 *
 * Приходит у дочерних строк при разворачивании по субконто-1
 * (`expandBySubkonto=true`). У строки-счёта `subkonto = null`; у дочерней
 * строки без аналитики (группа «Без субконто») `subkonto` тоже `null`.
 *
 * Ссылочное значение резолвится в имя так же, как измерения журнала
 * проводок: для субконто-справочника по `dictionaryEntryReferenceId`
 * через `useDictionaryEntry` / `resolveDictionaryEntryLabel`.
 */
export interface OsvSubkonto {
  /** Позиция субконто в плане счетов (1 — субконто-1). */
  position: number
  /** Вид значения субконто (DICTIONARY/DOCUMENT/…). */
  valueType?: string | null
  /** ID элемента справочника — для субконто-справочника. */
  dictionaryEntryReferenceId?: number | null
  /** ID записи плана видов характеристик — для характеристик. */
  characteristicsPlanEntryId?: number | null
}

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
  /**
   * Дочерние строки по субконто-1 (только при `expandBySubkonto=true`).
   * У самих дочерних строк `children = null` — разворот ровно на 1 уровень.
   */
  children?: OsvReportEntry[] | null
  /**
   * Аналитика субконто дочерней строки. `null` у строки-счёта и у группы
   * «Без субконто».
   */
  subkonto?: OsvSubkonto | null
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
