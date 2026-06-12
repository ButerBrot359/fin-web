/**
 * Карточка счёта (1С: РегистрБухгалтерии.ДвиженияССубконто) — построчная
 * выборка движений по счёту за период. Соответствует бэкендовому
 * AccountingRegisterMovementDto (эндпоинт `/movements`).
 */
export interface AccountCardEntry {
  id: number
  /** Период проводки (ISO date-time). */
  period?: string | null
  /** ID документа-регистратора (для ссылки на документ). */
  recorderDocumentEntryId?: number | null
  recorderDocumentTypeCode?: string | null
  lineNo?: number | null
  isActive?: boolean | null
  /** Код счёта по дебету. */
  accountDtCode?: string | null
  /** Код счёта по кредиту. */
  accountKtCode?: string | null
  summa?: number | string | null
  kolichestvoDt?: number | string | null
  kolichestvoKt?: number | string | null
  valyutnayaSummaDt?: number | string | null
  valyutnayaSummaKt?: number | string | null
  soderzhanie?: string | null
  /** Субконто проводки по дебету/кредиту (резолвятся в имена при рендере). */
  subkontosDt?: unknown[] | null
  subkontosKt?: unknown[] | null
}

/** Параметры запроса карточки счёта. */
export interface AccountCardParams {
  from: string
  to: string
  /** ID счёта (фильтр); если не задан — все счета. */
  accountId?: number
}
