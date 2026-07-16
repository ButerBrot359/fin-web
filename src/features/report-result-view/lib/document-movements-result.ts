import type { MovementGroup } from '@/pages/documents/document-movements'

/**
 * Спец-результат отчёта «Движения документа» (DvizheniyaDokumenta, CUSTOM_HANDLER):
 * бэк отдаёт НЕ табличный ReportResultDto (columns/rows), а группы движений
 * документа-регистратора — ровно тот же DTO (DocumentMovementGroupDto), что
 * кнопка «Дт/Кт (движения)» на форме документа.
 */
export interface DocumentMovementsReportResult {
  /** id документа-регистратора (параметр DokumentVladelets). */
  documentEntryId: number
  /** Представление документа («ТипДокумента № Код») — заголовок отчёта. */
  documentPresentation?: string | null
  /** 1С: «Отрицательное красным» — метаданные для будущего print-слоя. */
  negativeInRed?: boolean | null
  /** Группы движений — по одной на регистр с движениями. */
  groups: MovementGroup[]
}

/**
 * Детект спец-результата «Движения документа»: наличие `groups[]` +
 * `documentEntryId` (табличный ReportResultDto несёт columns/rows и ни того,
 * ни другого).
 */
export const isDocumentMovementsReportResult = (
  result: unknown
): result is DocumentMovementsReportResult => {
  if (result == null || typeof result !== 'object') return false
  const o = result as Record<string, unknown>
  return Array.isArray(o.groups) && o.documentEntryId != null
}
