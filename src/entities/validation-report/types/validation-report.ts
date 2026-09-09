// SCRUM-317: единый отчёт о проверке (спека v1 §2, v2 §2). Приходит двумя
// каналами — эффектом `validationReport` (HTTP 200) и ключом `validation`
// тела 422 DOCUMENT_VALIDATION — в одной и той же форме.

export type ValidationSeverity = 'ERROR' | 'WARNING'

export type ValidationSource =
  | 'REQUIRED_ATTRIBUTE'
  | 'BUSINESS_RULE'
  | 'OPERATION'

/**
 * Адрес цели сообщения — размеченное объединение по kind (v1 §2.3):
 * компилятор не даст прочитать rowIndex у FIELD. Провод шире типа —
 * неизвестный kind парсер приводит к «ненавигируемому» варианту.
 */
export type ValidationTarget =
  | { kind: 'DOCUMENT' }
  | { kind: 'FIELD'; fieldCode: string }
  | { kind: 'TABLE'; tableCode: string }
  | {
      kind: 'TABLE_CELL'
      tableCode: string
      /** ЛОГИЧЕСКИЙ номер строки ТЧ, 0-based — не позиция в разметке (v2 §7). */
      rowIndex: number
      columnCode: string
    }

export interface ValidationMessage {
  /** Стабилен только внутри одного отчёта; ключ списка и активного сообщения. */
  id: string
  /** Единственная ось цвета: ERROR — красный, WARNING — жёлтый (v1 §3.4). */
  severity: ValidationSeverity
  /** Служебная ось: не раскрашивать и не группировать (v1 §2.2). */
  source: ValidationSource | null
  /** Сорвало ли операцию. В счётчик панели НЕ входит (v2 §2.5). */
  blocking: boolean
  /** Готовый локализованный текст — выводить именно его. */
  message: string
  /** null или DOCUMENT = навигация невозможна; см. isTargetNavigable. */
  target: ValidationTarget | null
  /** Легаси-канал: запасной путь подсветки, когда target отсутствует (v2 §2.6). */
  attributeCode: string | null
}

export interface ValidationReport {
  /** Команда-источник; на канале 422 приходит null (v1 §2.6). */
  operation: string | null
  /** «Сколько сообщений сорвали операцию» — НЕ счётчик панели (v2 §2.5). */
  blockingCount: number
  messages: ValidationMessage[]
}
