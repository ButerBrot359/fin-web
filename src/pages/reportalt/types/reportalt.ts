/**
 * DTO нового отчётного контура ReportAlt (`/api/reportalt/*`).
 *
 * Контракт результата — field-for-field копия живого `ReportResultDto`
 * легаси-контура (`src/pages/reports`), см. ADR webbuh
 * `docs/project/reportalt/architecture.md` §10 (F2). Типы СОЗНАТЕЛЬНО
 * продублированы, а не импортированы из `src/pages/reports`: легаси-страница
 * может меняться независимо; структурная совместимость позволяет передавать
 * результат в общий рендерер `features/report-result-view` без приведения.
 */

/** Макет результата: плоский регистр, дерево или официальный бланк. */
export type ReportAltLayout = 'LEDGER' | 'TREE' | 'FORM'

/** Вид строки результата (как в живом контракте легаси-отчётов). */
export type ReportAltRowKind =
  | 'DATA'
  | 'GROUP_HEADER'
  | 'OPENING_BALANCE'
  | 'TURNOVER'
  | 'CLOSING_BALANCE'
  | 'SUBTOTAL'
  | 'TOTAL'

/** Роль поля/колонки (измерение/ресурс/реквизит/период). */
export type ReportAltFieldRole =
  | 'DIMENSION'
  | 'MEASURE'
  | 'ATTRIBUTE'
  | 'PERIOD'

/** Семейство колонки (группировка/раскраска шапки 1С). */
export type ReportAltColumnFamily =
  | 'OPENING'
  | 'TURNOVER_DT'
  | 'TURNOVER_KT'
  | 'CLOSING'
  | 'PLAIN'

/** Колонка результата (совместима с колонкой легаси-рендерера). */
export interface ReportAltColumnDto {
  code: string
  titleRu: string
  titleKz?: string
  role: ReportAltFieldRole
  valueType: string
  format?: string
  derived?: boolean
  columnFamily?: ReportAltColumnFamily
  negativeRed?: boolean
  blankOnZero?: boolean
  align?: 'LEFT' | 'RIGHT'
  groupTitleRu?: string
  groupTitleKz?: string
  subGroupTitleRu?: string
  subGroupTitleKz?: string
  width?: number
  dcIndicator?: boolean
}

/**
 * Строка результата — рекурсивное дерево: `level` — глубина, `cells` —
 * значения по кодам колонок, `children` — вложенные строки.
 */
export interface ReportAltRowDto {
  level: number
  groupCode?: string
  groupRefId?: number
  groupValue?: string
  cells: Record<string, unknown>
  children: ReportAltRowDto[]
  rowKind?: ReportAltRowKind
  labelText?: string
  labelColSpan?: number
}

/** Блок гос-бланка над титулом (реквизиты приказа / организация). */
export interface ReportAltHeaderBlockDto {
  side: 'LEFT' | 'RIGHT'
  lines: string[]
  underline: boolean
  caption: string | null
}

/** Подпись бланка («Исполнитель:» — должность/подпись/расшифровка). */
export interface ReportAltFormSignatureDto {
  role: string
  name?: string
  captions?: string[]
}

/** Секция официального бланка со своими колонками-графами. */
export interface ReportAltFormSectionDto {
  title?: string
  openingLine?: string
  columns: ReportAltColumnDto[]
  rows: ReportAltRowDto[]
  numberGraphs?: boolean
  graphNumberStart?: number
}

/** Официальный бланк (layout=FORM): шапка, секции, подписи. */
export interface ReportAltFormDto {
  legalHeader?: string[]
  formNumber?: string
  organizationLine?: string
  organizationCaption?: string
  title?: string
  periodLine?: string
  vedomostTitle?: string
  accountsLine?: string
  sections: ReportAltFormSectionDto[]
  footerLines?: string[]
  signatures?: ReportAltFormSignatureDto[]
  noteLines?: string[]
}

/** Результат формирования отчёта (`POST /api/reportalt/{code}/run`). */
export interface ReportAltResultDto {
  reportCode: string
  reportNameRu: string
  reportNameKz?: string
  appliedParameters: Record<string, unknown>
  columns: ReportAltColumnDto[]
  rows: ReportAltRowDto[]
  total: Record<string, unknown>
  layout?: ReportAltLayout
  titleTemplate?: string
  appliedTitleValues?: Record<string, unknown>
  organizationTitle?: string
  subtitleLines?: string[]
  form?: ReportAltFormDto
  language?: string
  headerBlocks?: ReportAltHeaderBlockDto[]
  periodLine?: string
  footerBlock?: ReportAltFormSignatureDto
  groupFloorCodes?: string[]
  /** Пагинация LEDGER (F4): номер выданной страницы. */
  page?: number
  /** Пагинация LEDGER: размер страницы. */
  pageSize?: number
  /** Пагинация LEDGER: есть ли ещё страницы. */
  hasMore?: boolean
  /** Пагинация LEDGER: смещение следующей страницы. */
  nextOffset?: number
}

/** Тип параметра отчёта — какой инпут рендерить в форме. */
export type ReportAltParameterType =
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

/** Одно допустимое значение параметра (NUMBER-выпадашка, напр. периодичность). */
export interface ReportAltAllowedValue {
  value: number | string
  titleRu: string
  titleKz?: string
}

/** Параметр отчёта — описание поля динамической формы. */
export interface ReportAltParameterDto {
  code: string
  titleRu: string
  titleKz?: string
  dataType: ReportAltParameterType
  required: boolean
  /** Множественный выбор (список счетов и т.п.). */
  allowList?: boolean
  defaultValue?: unknown
  /** typeCode справочника/плана счетов — источник значений REF-типов. */
  referenceDomain?: string
  /** Логическая группа параметра (period/account/organization/…). */
  group?: string
  allowedValues?: ReportAltAllowedValue[]
}

/** Строка списка отчётов (`GET /api/reportalt/reports`) и `meta.definition`. */
export interface ReportAltDefinitionDto {
  code: string
  code1C?: string
  nameRu: string
  nameKz?: string
  layout: ReportAltLayout
  moduleGroup?: string
  sortOrder?: number
}

/** Вариант отчёта (предустановленная структура). */
export interface ReportAltVariantDto {
  code: string
  nameRu: string
  nameKz?: string
}

/** Отбор отчёта (описание доступного поля отбора из meta). */
export interface ReportAltFilterFieldDto {
  field: string
  titleRu: string
  titleKz?: string
  valueType?: string
  referenceDomain?: string
  comparisons?: string[]
  defaultComparison?: string
}

/** Метаданные отчёта (`GET /api/reportalt/{code}/meta`). */
export interface ReportAltMetaDto {
  definition: ReportAltDefinitionDto
  parameters: ReportAltParameterDto[]
  /** Скелет колонок результата (для настроек до формирования). */
  columns?: ReportAltColumnDto[]
  variants?: ReportAltVariantDto[]
  filters?: ReportAltFilterFieldDto[]
}

/** Элемент отбора в теле `/run` (плоский item; группы AND/OR — фаза 2). */
export interface RunReportAltFilter {
  field: string
  comparison: string
  values: (number | string)[]
}

/** Тело запроса `POST /api/reportalt/{code}/run`. */
export interface RunReportAltBody {
  parameters: Record<string, unknown>
  variantCode?: string
  filters?: RunReportAltFilter[]
  /** Пагинация LEDGER (F4): номер страницы (0-based). */
  page?: number
  pageSize?: number
}
