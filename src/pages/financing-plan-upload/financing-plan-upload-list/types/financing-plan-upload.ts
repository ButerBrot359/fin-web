/**
 * Загрузка плана финансирования (обработка / DataProcessor): загрузка Excel
 * с планом финансирования, предпросмотр распарсенных строк, формирование и
 * проведение документа. Контракт повторяет бэкендовые DTO эндпоинтов
 * `/api/financing-plan-upload/parse` и `/api/financing-plan-upload/generate`.
 */

/** Вид плана финансирования (MVP — по обязательствам). */
export const VID_PLANA_PO_OBYAZATELSTVAM = 'PlanFinansirovaniyaPoObyazatelstvam'

/** Код типа enum «Виды плана финансирования». */
export const VID_PLANA_ENUM_TYPE_CODE = 'VidyPlanaFinansirovaniya'

/** Справочники-источники опций автокомплитов (домен DICTIONARY). */
export const ISTOCHNIK_DICTIONARY_TYPE_CODE = 'VidyIstochnikovFinansirovaniya'
export const DVIZHENIE_DICTIONARY_TYPE_CODE = 'DvizheniyaFinansirovaniya'

/** Имя листа Excel по умолчанию (бэк подставляет сам — НЕ отправляем). */
export const DEFAULT_SHEET_NAME = 'Лист 1'

/** Коды операций обработки (для диалога выбора). */
export const OPERATION_FROM_FILE = 'IzFayla'
export const OPERATION_FROM_PORTAL = 'IzPortala'

/** Параметры формы загрузки (черновик до отправки на parse). */
export interface UploadFormState {
  /** Дата документа (ISO date, e.g. "2026-01-01"). */
  data: string
  organizatsiyaId: number | null
  vidPlana: string | null
  istochnikFinansirovaniyaId: number | null
  dvizhenieFinansirovaniyaId: number | null
  /** Имя листа Excel — отправляется только если пользователь его изменил. */
  sheetName: string
  startRow: number
  /** Смещение колонок — undefined = авто (бэк определяет сам). */
  columnOffset: number | null
  /** true = суммы в тысячах тенге, false = в тенге. */
  vTysTenge: boolean
}

/** Распарсенная строка плана (ParsedRow на бэке). */
export interface ParsedRow {
  rowNumber: number
  fkrId: number | null
  fkrCode: string | null
  fkrNameRu: string | null
  spetsifikaId: number | null
  spetsifikaCode: string | null
  spetsifikaNameRu: string | null
  schetFinansirovaniyaId: number | null
  schetKassovykhRaskhodovId: number | null
  statyaDdsId: number | null
  summaItogo: number
  summaPeriod1: number
  summaPeriod2: number
  summaPeriod3: number
  summaPeriod4: number
  summaPeriod5: number
  summaPeriod6: number
  summaPeriod7: number
  summaPeriod8: number
  summaPeriod9: number
  summaPeriod10: number
  summaPeriod11: number
  summaPeriod12: number
  warnings: string[]
  errors: string[]
}

/** Тело ответа эндпоинта parse (внутри обёртки `{ data, success }`). */
export interface ParseResult {
  canGenerate: boolean
  errors: string[]
  rows: ParsedRow[]
}

/** Параметры запроса parse (multipart-поля кроме самого файла). */
export interface ParseRequestParams {
  organizatsiyaId: number
  vidPlana: string
  startRow: number
  vTysTenge: boolean
  data: string
  /** Отправляется только если пользователь ввёл непустое значение. */
  sheetName?: string
  /** Отправляется только если задано (иначе авто). */
  columnOffset?: number
}

/** Строка запроса generate — ТОЛЬКО суммы и измерения (счета бэк резолвит сам). */
export interface GenerateRow {
  fkrId: number | null
  spetsifikaId: number | null
  summaItogo: number
  summaPeriod1: number
  summaPeriod2: number
  summaPeriod3: number
  summaPeriod4: number
  summaPeriod5: number
  summaPeriod6: number
  summaPeriod7: number
  summaPeriod8: number
  summaPeriod9: number
  summaPeriod10: number
  summaPeriod11: number
  summaPeriod12: number
}

/** Тело запроса generate (application/json). */
export interface GenerateRequest {
  organizatsiyaId: number
  vidPlana: string
  data: string
  vidOperatsii?: string
  istochnikFinansirovaniyaId?: number
  dvizhenieFinansirovaniyaId?: number
  otvetstvennyyId?: number
  kommentariy?: string
  rows: GenerateRow[]
}

/** Тело ответа generate (внутри обёртки `{ data, success }`). */
export interface GenerateResult {
  documentId: number
  number: string
  posted: boolean
}

/** Номера периодов 1..12 — для рендера колонок-месяцев и сборки строк. */
export const PERIOD_INDICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

/** Поле periodN по индексу (типобезопасно для ParsedRow/GenerateRow). */
export type PeriodKey = `summaPeriod${(typeof PERIOD_INDICES)[number]}`
