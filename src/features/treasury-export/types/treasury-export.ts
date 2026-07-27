/** Документ для выгрузки в казначейство. */
export interface TreasuryExportItem {
  typeCode: string
  id: number
}

/** Строка таблицы «Выгружаемые документы» (ответ preview). */
export interface TreasuryExportPreviewRow {
  n: number
  documentId: number
  typeCode: string
  presentation: string
  amount: number | null
  errors: string[]
  fileName: string | null
}

/** Ответ POST /api/treasury-export/preview (в `data` обёртки ApiResponse). */
export interface TreasuryExportPreviewResponse {
  rows: TreasuryExportPreviewRow[]
  hasErrors: boolean
}
