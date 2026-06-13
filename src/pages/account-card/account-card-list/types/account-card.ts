/**
 * Карточка счёта (1С: РегистрБухгалтерии.ДвиженияССубконто) — построчная
 * выборка движений по счёту за период. Соответствует бэкендовому
 * AccountingRegisterMovementDto (эндпоинт `/movements`).
 */
/** Ссылочное значение измерения проводки: {id, presentation} (резолвлено бэком). */
export interface RefOption {
  id?: number | null
  presentation?: string | null
}

/** Субконто проводки (резолвлено бэком — есть displayName/nameRu). */
export interface AccountCardSubkonto {
  side?: string | null
  position?: number | null
  displayName?: string | null
  nameRu?: string | null
  code?: string | null
}

export interface AccountCardEntry {
  id: number
  /** Период проводки (ISO date-time). */
  period?: string | null
  /** ID документа-регистратора (для ссылки на документ). */
  recorderDocumentEntryId?: number | null
  recorderDocumentTypeCode?: string | null
  /** Представление документа «тип + номер + дата». */
  recorderDocumentName?: string | null
  recorderDocumentNumber?: string | null
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
  /** Субконто проводки по дебету/кредиту (резолвлены в имена). */
  subkontosDt?: AccountCardSubkonto[] | null
  subkontosKt?: AccountCardSubkonto[] | null
  /** Измерения проводки (резолвлены). */
  fkr?: RefOption | null
  spetsifika?: RefOption | null
  istochnikFinansirovaniya?: RefOption | null
  podrazdelenie?: RefOption | null
  organizatsiya?: RefOption | null
  kodPlatnykhUslug?: RefOption | null
}

/** Параметры запроса карточки счёта. */
export interface AccountCardParams {
  from: string
  to: string
  /** ID счёта (фильтр); если не задан — все счета. */
  accountId?: number
}
