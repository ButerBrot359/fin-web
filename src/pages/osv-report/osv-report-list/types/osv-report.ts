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
  /** Кол-во: сальдо на начало, Дт. */
  openingQtyDt?: number | string | null
  /** Кол-во: сальдо на начало, Кт. */
  openingQtyKt?: number | string | null
  /** Кол-во: оборот за период, Дт. */
  turnoverQtyDt?: number | string | null
  /** Кол-во: оборот за период, Кт. */
  turnoverQtyKt?: number | string | null
  /** Кол-во: сальдо на конец, Дт. */
  closingQtyDt?: number | string | null
  /** Кол-во: сальдо на конец, Кт. */
  closingQtyKt?: number | string | null
  /**
   * Дочерние узлы дерева ОСВ (при `groupByDimensions=true`). Рекурсивно
   * вложены по фиксированному порядку уровней:
   * Счёт → ORGANIZATION → PODRAZDELENIE → FKR → SPETSIFIKA →
   * ISTOCHNIK_FINANSIROVANIYA → SUBKONTO(лист). `null` у листьев.
   */
  children?: OsvReportEntry[] | null
  /**
   * Аналитика субконто листа-узла (`groupLevel === 'SUBKONTO'`). `null`
   * у строки-счёта и у узлов измерений (не-субконто уровней).
   */
  subkonto?: OsvSubkonto | null
  /**
   * Уровень группировки узла:
   * "ORGANIZATION"|"PODRAZDELENIE"|"FKR"|"SPETSIFIKA"|
   * "ISTOCHNIK_FINANSIROVANIYA"|"SUBKONTO". `null` у строки-счёта.
   */
  groupLevel?: string | null
  /** ID элемента группировки. `null` = группа «Без значения». */
  groupRefId?: number | null
  /**
   * Готовое имя элемента группировки (бэк уже резолвит). `null` для
   * группы «Без значения».
   */
  groupRefName?: string | null
}

/**
 * Серверная строка «Итого» ОСВ — суммы 6 колонок по счетам верхнего уровня
 * (БЕЗ забалансовых) + признак сходимости двойной записи. Считается на бэке
 * (бэкендовый AccountingRegisterTotalDto), фронт больше НЕ суммирует сам.
 */
export interface OsvReportTotal {
  openingDt?: number | string | null
  openingKt?: number | string | null
  turnoverDt?: number | string | null
  turnoverKt?: number | string | null
  closingDt?: number | string | null
  closingKt?: number | string | null
  openingQtyDt?: number | string | null
  openingQtyKt?: number | string | null
  turnoverQtyDt?: number | string | null
  turnoverQtyKt?: number | string | null
  closingQtyDt?: number | string | null
  closingQtyKt?: number | string | null
  /**
   * Сошлась ли двойная запись (Σ Дт == Σ Кт по всем трём парам колонок).
   * `null` — проверка не выполнялась (отчёт по одному счёту: вторая нога
   * проводки вне выборки, баланс заведомо не сойдётся).
   */
  balanced?: boolean | null
  /** Расхождение Дт−Кт по начальному сальдо. `null` если не проверялось. */
  openingDiff?: number | string | null
  /** Расхождение Дт−Кт по оборотам. `null` если не проверялось. */
  turnoverDiff?: number | string | null
  /** Расхождение Дт−Кт по конечному сальдо. `null` если не проверялось. */
  closingDiff?: number | string | null
}

/** Параметры запроса ОСВ. */
export interface OsvReportParams {
  /** Начало периода — ISO date-time. */
  from: string
  /** Конец периода — ISO date-time. */
  to: string
  /** Фильтр по счёту (опционально; пусто = все счета). */
  accountId?: number
  /**
   * Упорядоченный список измерений-уровней группировки (коды бэка). Пусто =
   * без разворота по измерениям. Управляется панелью «Настройки → Группировка».
   */
  groupBy?: string[]
  /** Разворачивать листы по субконто-1 («По субконто»). */
  expandBySubkonto?: boolean
}

/**
 * Измерения-уровни группировки ОСВ (порядок фиксирован, как в 1С) — код уровня
 * для бэка + i18n-метка. Состав/включённость задаёт пользователь в настройках.
 */
export const OSV_GROUP_DIMENSIONS = [
  { key: 'ORGANIZATION', labelKey: 'osv.levelOrganization' },
  { key: 'PODRAZDELENIE', labelKey: 'osv.levelSubdivision' },
  { key: 'FKR', labelKey: 'osv.levelFkr' },
  { key: 'SPETSIFIKA', labelKey: 'osv.levelSpetsifika' },
  { key: 'ISTOCHNIK_FINANSIROVANIYA', labelKey: 'osv.levelFundingSource' },
] as const

/** Все коды измерений (для дефолтного «всё включено»). */
export const OSV_ALL_DIMENSIONS: string[] = OSV_GROUP_DIMENSIONS.map(
  (d) => d.key
)
