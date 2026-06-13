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
  /** Имя вида субконто (Номенклатура, Физические лица…) — для группировки. */
  kindRu?: string | null
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
  /**
   * Вычисленные бэком поля карточки (когда задан accountId). Фронт их только
   * рендерит — вся учётная математика (сторона Дт/Кт, накопительное сальдо,
   * корр-счёт) считается на сервере.
   */
  debit?: number | string | null
  credit?: number | string | null
  debitKolichestvo?: number | string | null
  creditKolichestvo?: number | string | null
  /** Код корр-счёта (противоположная сторона проводки). */
  korrAccountCode?: string | null
  /** Накопительное текущее сальдо ПОСЛЕ проводки (signed: + Дт / − Кт). */
  runningBalance?: number | string | null
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
  /**
   * Фильтры по аналитике, наследуемые при drill-down из ОСВ (когда кликнули
   * по узлу измерения дерева — карточка строится только по этой аналитике).
   */
  organizatsiyaId?: number
  podrazdelenieId?: number
  fkrId?: number
  spetsifikaId?: number
  istochnikFinansirovaniyaId?: number
  kodPlatnykhUslugId?: number
}

/**
 * Серверные агрегаты карточки за весь период с учётом фильтров (бэк считает
 * по ВСЕМ движениям, не завися от страницы). Нужны для корректных строк
 * «Обороты за период» / «Конечное сальдо» при постраничной (lazy) загрузке.
 */
export interface AccountCardTotals {
  /** Всего движений (для пагинации). */
  totalCount: number
  /** Оборот за период Дт / Кт по счёту карточки. */
  turnoverDt: number
  turnoverKt: number
  /** Кол-во Дт / Кт за период. */
  kolichestvoDt: number
  kolichestvoKt: number
  /** Сальдо на начало периода (signed) — вычислено бэком. */
  openingBalance: number
  /** Конечное сальдо (signed) = openingBalance + turnoverDt − turnoverKt. */
  closingBalance: number
}

/**
 * Группировка аналитики (вкладка «Группировка» в настройках, как в 1С): какие
 * измерения и виды субконто показывать в колонках «Аналитика Дт/Кт». Храним как
 * множество ключей СКРЫТЫХ групп — пусто = показываем всё (поведение 1С по
 * умолчанию). Ключи измерений — из `DIMENSION_GROUP_ITEMS`; ключи субконто —
 * `subkonto:<видСубконто>` по `kindRu` (или общий `subkonto`, если вид не задан).
 */
export type HiddenAnalyticsGroups = ReadonlySet<string>

/** Фиксированные измерения-чекбоксы группировки: ключ entry-поля + i18n-метка. */
export const DIMENSION_GROUP_ITEMS = [
  { key: 'organizatsiya', labelKey: 'accountCard.groupOrganizatsiya' },
  { key: 'podrazdelenie', labelKey: 'accountCard.groupPodrazdelenie' },
  { key: 'fkr', labelKey: 'accountCard.groupFkr' },
  { key: 'spetsifika', labelKey: 'accountCard.groupSpetsifika' },
  { key: 'istochnik', labelKey: 'accountCard.groupIstochnik' },
  { key: 'kodPlatnykhUslug', labelKey: 'accountCard.groupKodPlatnykhUslug' },
] as const

/** Ключ группы субконто по виду (`kindRu`) — для динамических чекбоксов. */
export const subkontoGroupKey = (kindRu?: string | null): string =>
  kindRu ? `subkonto:${kindRu}` : 'subkonto'

/** Список query-параметров фильтров аналитики (URL ⇄ запрос). */
export const ANALYTICS_FILTER_KEYS = [
  'organizatsiyaId',
  'podrazdelenieId',
  'fkrId',
  'spetsifikaId',
  'istochnikFinansirovaniyaId',
  'kodPlatnykhUslugId',
] as const

export type AnalyticsFilterKey = (typeof ANALYTICS_FILTER_KEYS)[number]
