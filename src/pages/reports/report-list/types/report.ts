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

/** Тип параметра отчёта — определяет, какой инпут рендерить в форме. */
export type ReportParameterType =
  | 'DATE'
  | 'PERIOD'
  | 'ACCOUNT_LIST'
  | 'DICTIONARY_REF'
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
  cells: Record<string, unknown>
  children: ReportRowDto[]
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
}

/** Тело запроса формирования отчёта. */
export interface RunReportBody {
  variantCode?: string
  parameters: Record<string, unknown>
}

/** Параметры списка отчётов (`/api/reports`). */
export interface ReportsListParams {
  subsystem?: string
  kind?: ReportKind
  status?: ReportStatus
}
