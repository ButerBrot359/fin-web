export type SwiftFormat = 'FORMAT_10_2023' | 'FORMAT_01_2024' | 'FORMAT_01_2025'

export type SwiftEncoding = 'KZ_1048' | 'OEM' | 'UTF_8' | 'UTF_16'

export interface SwiftExportRequest {
  documentIds: number[]
  format: SwiftFormat
  encoding: SwiftEncoding
}

export interface SwiftExportPreviewRow {
  number: number
  documentId: number
  documentNumber: string | null
  amount: number | null
  fileName: string | null
  errors: string[]
}

export interface SwiftExportPreview {
  rows: SwiftExportPreviewRow[]
  hasErrors: boolean
}
