// Уведомление о пересчёте после правки задним числом (SCRUM-330, ADR-0079
// блок Б, handoff §3.1). Форма ОБЩАЯ для всех каналов доставки:
// DocumentEntry.recalculationNotices (синхронное проведение/отмена REST),
// AsyncTask.recalculationNotices (фоновая задача, только SUCCEEDED),
// AiAssistantCreatedDocument.recalculationNotices (чат помощника).

export type RecalculationNoticeKind = 'STALE' | 'CHECK_FAILED' | 'CHECK_SKIPPED'

export interface RecalculationNotice {
  kind: RecalculationNoticeKind
  /** Что вызвало проверку. */
  operation: 'POST' | 'UNPOST'
  /** Код зависимости (raschet-amortizatsii и т.п.) — для рендера не нужен. */
  dependencyCode: string
  /** Всегда "warning" — своё поле, а не производное от kind; красим по нему. */
  level: string
  /** Готовый локализованный текст; кликабелен при непустом route. */
  message: string
  /** null для CHECK_FAILED/CHECK_SKIPPED — адресата нет вовсе. */
  targetKind?: string | null
  /** Готовый SDUI-маршрут /documents/<TypeCode>/<id>; null — тост некликабельный. */
  route?: string | null
  documentId?: number | null
  documentTypeCode?: string | null
  documentNumber?: string | null
  /** ISO-дата. */
  documentDate?: string | null
  /** Общее число найденных устаревших расчётов. */
  totalCount: number
  periodFrom?: string | null
  /** Зарплата: может быть несколько месяцев; текст message их уже перечисляет. */
  periodsToRecalculate: string[]
  /** Нужно только групповому перепроведению на бэке — фронт не рендерит. */
  affectedDocumentIds: number[]
}
