/**
 * DTO универсального домена отчётов (`/api/reports`) — аналог universal-domain
 * для справочников/документов, но для отчётов. Бэкенд отдаёт метаданные любого
 * отчёта по коду, а фронт строит форму параметров и таблицу результата
 * динамически. Имена полей копируются 1-в-1 с бэкенда.
 */

/** Класс отчёта (как в 1С: СКД, мемориальный ордер, регламентированный, кастом). */
export type ReportKind =
  | 'DATA_COMPOSITION'
  | 'MEMORIAL_ORDER'
  | 'REGULATED'
  | 'CUSTOM'

/** Движок формирования отчёта на бэке. */
export type ReportEngine =
  | 'GENERIC_COMPOSITION'
  | 'NATIVE_DELEGATE'
  | 'CUSTOM_HANDLER'
  | 'TEMPLATE_RENDERER'

/** Статус отчёта: DRAFT — ещё не реализован (бэк отвечает 422). */
export type ReportStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED'

/** Роль поля/колонки в отчёте (измерение/ресурс/реквизит/период). */
export type ReportFieldRole = 'DIMENSION' | 'MEASURE' | 'ATTRIBUTE' | 'PERIOD'

/**
 * Вид строки результата (унифицированный 1С-рендерер). `null`/отсутствие ⇒
 * обычная строка данных (старое поведение).
 * - `DATA` — обычная строка движения/данных;
 * - `GROUP_HEADER` — узел-группа в дереве (жирный);
 * - `OPENING_BALANCE`/`CLOSING_BALANCE` — «Сальдо на начало/конец»;
 * - `TURNOVER` — «Обороты за период»;
 * - `SUBTOTAL` — промежуточный итог; `TOTAL` — итог.
 */
export type RowKind =
  | 'DATA'
  | 'GROUP_HEADER'
  | 'OPENING_BALANCE'
  | 'TURNOVER'
  | 'CLOSING_BALANCE'
  | 'SUBTOTAL'
  | 'TOTAL'

/** Семейство колонки (для группировки/раскраски шапки 1С). */
export type ReportColumnFamily =
  | 'OPENING'
  | 'TURNOVER_DT'
  | 'TURNOVER_KT'
  | 'CLOSING'
  | 'PLAIN'

/**
 * Макет результата: плоский регистр (LEDGER), дерево (TREE) или официальный
 * бланк (FORM — мемориальные ордера, см. {@link ReportFormDto}).
 */
export type ReportLayout = 'LEDGER' | 'TREE' | 'FORM'

/** Секция бланка (дебет/кредит субсчёта) со СВОИМИ колонками-графами. */
export interface ReportFormSectionDto {
  /** Заголовок секции («Дебет субсчёта № 1010»). */
  title?: string
  /** Строка остатка на начало («Остаток на начало месяца: 0»). */
  openingLine?: string
  /** Колонки секции: №, дата, графы-кор.счета…, Итого. */
  columns: ReportColumnDto[]
  /** Строки: DATA + финальная TOTAL «Итого:». */
  rows: ReportRowDto[]
  /** Рендерить строку сквозной нумерации граф. */
  numberGraphs?: boolean
  /** Номер первой графы секции (1 у дебетовой, продолжение у кредитовой). */
  graphNumberStart?: number
}

/** Подпись бланка («Исполнитель:» — должность/подпись/расшифровка). */
export interface ReportFormSignatureDto {
  role: string
  name?: string
  captions?: string[]
}

/**
 * Блок гос-бланка над титулом (напр. М-44): реквизиты приказа (side=RIGHT) или
 * организация (side=LEFT). `lines` выводятся КАК ЕСТЬ (пробелы байт-в-байт).
 * `underline` — линия-строка под текстом (рукописная строка бланка); `caption` —
 * мелкая приглушённая подпись под блоком (или null).
 */
export interface ReportHeaderBlockDto {
  side: 'LEFT' | 'RIGHT'
  lines: string[]
  underline: boolean
  caption: string | null
}

/** Официальный бланк (мемориальный ордер): шапка, секции, остатки, подписи. */
export interface ReportFormDto {
  /** Правовой гриф (несколько строк, мелкий шрифт слева). */
  legalHeader?: string[]
  /** «Форма № 381». */
  formNumber?: string
  organizationLine?: string
  organizationCaption?: string
  /** «№ 1 Мемориальный ордер». */
  title?: string
  /** «Период: Январь 2024 г.». */
  periodLine?: string
  /** Название накопительной ведомости. */
  vedomostTitle?: string
  /** «№ 1010». */
  accountsLine?: string
  sections: ReportFormSectionDto[]
  /** Строки футера («Остаток на конец месяца: …»). */
  footerLines?: string[]
  signatures?: ReportFormSignatureDto[]
}

/** Тип параметра отчёта — определяет, какой инпут рендерить в форме. */
export type ReportParameterType =
  | 'DATE'
  | 'PERIOD'
  | 'ACCOUNT_LIST'
  | 'ACCOUNT_REF'
  | 'DICTIONARY_REF'
  | 'ENUM_REF'
  | 'REF_LIST'
  | 'BOOLEAN'
  | 'STRING'
  | 'NUMBER'

/** Карточка отчёта (список `/api/reports`). */
export interface ReportDefinitionDto {
  code: string
  code1C: string
  nameRu: string
  nameKz: string
  description?: string
  kind: ReportKind
  engineType: ReportEngine
  status: ReportStatus
  subsystem?: string
}

/**
 * Значение ячейки результата. Обычно скаляр; для многострочных колонок
 * аналитики — массив строк (каждый элемент = одна строка, как стопка субконто).
 */
export type ReportCellValue = string | number | boolean | string[] | null

/** Колонка результата отчёта. */
export interface ReportColumnDto {
  code: string
  titleRu: string
  titleKz?: string
  role: ReportFieldRole
  valueType: string
  /** Формат значения (для MEASURE — числовой формат). */
  format?: string
  /** Вычисляемая колонка (бэк считает на лету). */
  derived?: boolean
  /** Семейство колонки (1С-рендерер): OPENING/TURNOVER_DT/.../PLAIN. */
  columnFamily?: ReportColumnFamily
  /** Красить значение красным, если <0 (для MEASURE). */
  negativeRed?: boolean
  /** Скрывать значение при нуле (пустая ячейка вместо «0»). */
  blankOnZero?: boolean
  /** Явное выравнивание ячейки (LEFT/RIGHT); по умолчанию — по роли. */
  align?: 'LEFT' | 'RIGHT'
  /**
   * Верхний ряд многоуровневой шапки (как «Дебет субсчетов» над счётами в 1С).
   * Соседние колонки с одинаковым groupTitle объединяются colspan;
   * колонки без groupTitle занимают всю высоту шапки (rowspan на все ряды).
   */
  groupTitleRu?: string
  groupTitleKz?: string
  /**
   * Средний ряд трёхуровневой шапки (напр. счёт «7060» над парами
   * «специфика/сумма» внутри группы «Дебет субсчетов»). Соседние колонки
   * с одинаковым subGroupTitle объединяются colspan внутри своей группы;
   * колонка с заданным groupTitle, но без subGroupTitle, занимает средний и
   * нижний ряды (rowspan=2).
   */
  subGroupTitleRu?: string
  subGroupTitleKz?: string
  /** Ширина колонки в символах (≈ width × 8px); null ⇒ авто. */
  width?: number
  /** Рендер значения с 1С-признаком сальдо: «Д <abs>» при ≥0, «К <abs>» при <0. */
  dcIndicator?: boolean
}

/** Одно допустимое значение параметра (для NUMBER с фиксированным списком). */
export interface ReportAllowedValue {
  value: number | string
  titleRu: string
  titleKz?: string
}

/** Параметр отчёта — описание поля формы параметров. */
export interface ReportParameterDto {
  code: string
  titleRu: string
  titleKz?: string
  dataType: ReportParameterType
  required: boolean
  /** Множественный выбор (например, список счетов). */
  allowList: boolean
  defaultValue?: unknown
  /** typeCode справочника/плана счетов — источник значений для REF-типов. */
  referenceDomain?: string
  /** Логическая группа параметра (period/account/organization/…). */
  group?: string
  /** Фиксированный список значений (для NUMBER-выпадашек, напр. периодичность). */
  allowedValues?: ReportAllowedValue[]
}

/** Отбор отчёта (вкладка «Отборы» в настройках). */
export interface ReportFilterDto {
  field: string
  titleRu: string
  titleKz?: string
  valueType?: string
  /** typeCode справочника-источника значений отбора. */
  referenceDomain?: string
  multi?: boolean
  comparisons?: string[]
  defaultComparison?: string
  /** Группа отбора: "kbp" (КБП-каталог) | "subkonto" (субконто счёта). */
  group?: string
  /** ID вида субконто (CharacteristicsPlanEntry.id) — routing-ключ для /run. Только у субконто-полей. */
  kindId?: number
  /** Позиция вида субконто на счёте (1..3) — для сортировки строк отбора. */
  position?: number
  /** 1С показывает эту строку отбора сразу (виды субконто выбранного счёта). */
  defaultShown?: boolean
}

/** Показатель отчёта (вкладка «Показатели» — управляет видимостью колонок). */
export interface ReportIndicatorDto {
  code: string
  titleRu: string
  titleKz?: string
  defaultEnabled: boolean
  /** Коды колонок результата, скрываемые при выключении показателя. */
  controlsColumns?: string[]
}

/** Вариант отчёта (предустановленный набор группировок). */
export interface ReportVariantDto {
  code: string
  nameRu: string
  nameKz: string
  groupings: string[]
}

/** Метаданные отчёта: определение + параметры + колонки + варианты. */
export interface ReportMetaDto {
  definition: ReportDefinitionDto
  parameters: ReportParameterDto[]
  columns: ReportColumnDto[]
  variants: ReportVariantDto[]
  filters: ReportFilterDto[]
  indicators: ReportIndicatorDto[]
}

/**
 * Строка результата — рекурсивное дерево (как ОСВ): `level` — глубина,
 * `cells` — значения по кодам колонок, `children` — вложенные строки.
 */
export interface ReportRowDto {
  level: number
  groupCode?: string
  groupRefId?: number
  groupValue?: string
  /**
   * Значения по кодам колонок. Скаляр ∥ `string[]` (стопка строк аналитики) —
   * см. {@link ReportCellValue}. Тип оставлен `unknown` ради совместимости со
   * старым DTO; рендерер сужает по метаданным колонки.
   */
  cells: Record<string, unknown>
  children: ReportRowDto[]
  /** Вид строки (1С-рендерер): DATA/GROUP_HEADER/итоги/сальдо. null ⇒ DATA. */
  rowKind?: RowKind
  /** Текст подписи строки-итога/сальдо (LEDGER span-row). */
  labelText?: string
  /**
   * Сколько первых колонок занимает подпись span-строки (LEDGER): 0-based
   * индекс первой колонки, где начинаются значения `cells`.
   */
  labelColSpan?: number
}

/** Результат формирования отчёта (`/api/reports/{code}/run`). */
export interface ReportResultDto {
  reportCode: string
  reportNameRu: string
  reportNameKz?: string
  appliedParameters: Record<string, unknown>
  columns: ReportColumnDto[]
  rows: ReportRowDto[]
  total: Record<string, unknown>
  /** Макет таблицы: LEDGER (плоский) или TREE (дерево). Отсутствие ⇒ TREE. */
  layout?: ReportLayout
  /** Шаблон заголовка над таблицей, напр. «Карточка счёта {account} за {from} — {to}». */
  titleTemplate?: string
  /** Значения для подстановки в `titleTemplate` ({from},{to},{account}…). */
  appliedTitleValues?: Record<string, unknown>
  /** Представление организации над заголовком (1С печатает её первой строкой). */
  organizationTitle?: string
  /** Строки под заголовком: «Выводимые данные: Сумма» и т.п. */
  subtitleLines?: string[]
  /** Официальный бланк (layout=FORM): мемориальные ордера. */
  form?: ReportFormDto
  /** Блоки гос-бланка над титулом (М-44): реквизиты приказа / организация. */
  headerBlocks?: ReportHeaderBlockDto[]
  /** Строка периода под титулом («Период: 01.01.2026 - 01.01.2027»). Пусто ⇒ не рендерить. */
  periodLine?: string
  /** Подвал-подписи после таблицы (структура — как подпись мем-ордера). */
  footerBlock?: ReportFormSignatureDto
}

/** Структурный отбор в теле запроса формирования отчёта. */
export interface RunReportFilter {
  field: string
  comparison: string
  values: (number | string)[]
  /** ID вида субконто — обязателен для субконто-отбора (иначе бэк не сматчит). */
  kindId?: number
}

/** Тело запроса формирования отчёта. */
export interface RunReportBody {
  variantCode?: string
  parameters: Record<string, unknown>
  filters?: RunReportFilter[]
}

/** Параметры списка отчётов (`/api/reports`). */
export interface ReportsListParams {
  subsystem?: string
  kind?: ReportKind
  status?: ReportStatus
}
