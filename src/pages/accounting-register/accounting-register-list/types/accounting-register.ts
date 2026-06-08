export interface AccountingRegisterEntry {
  id: number
  /** ISO datetime — период (дата) проводки. */
  period?: string | null
  /**
   * Reference на DocumentEntry-регистратор (бэк отдаёт только ID).
   * UI-разрешение по ID — см. TODO(phase-3-frontend) в `value-controls.tsx`.
   */
  recorderDocumentEntryId?: number | null
  /** Номер строки проводки внутри документа-регистратора. */
  lineNo?: number | null
  /** false — проводка сторнирована/деактивирована. */
  isActive?: boolean
  /** ID счёта дебета (FK на AccountPlanEntry). */
  accountDtId?: number | null
  /** Код счёта дебета (для чтения). */
  accountDtCode?: string | null
  /** ID счёта кредита (FK на AccountPlanEntry). */
  accountKtId?: number | null
  /** Код счёта кредита (для чтения). */
  accountKtCode?: string | null
  /** Сумма проводки в базовой валюте (тенге). */
  summa?: number | string | null
  /** Содержание проводки (текстовое описание операции). */
  soderzhanie?: string | null
  attributes: Record<string, unknown> | null
  /**
   * Значения системных колонок-измерений (Организация/ФКР/Специфика/…)
   * лежат прямо в строке под ключом = `code` колонки из `/columns`,
   * а НЕ в `values[]`. Тип — ID элемента справочника.
   */
  [systemColumnCode: string]: unknown
}
