import type { DocumentAttribute } from '@/entities/document-type'

export const buildEmptyRow = (
  columns: DocumentAttribute[]
): Record<string, unknown> => {
  const row: Record<string, unknown> = {}
  for (const col of columns) {
    switch (col.dataType) {
      case 'STRING':
      case 'TEXT':
        row[col.code] = ''
        break
      case 'INTEGER':
      case 'DECIMAL':
        row[col.code] = 0
        break
      case 'BOOLEAN':
        row[col.code] = false
        break
      default:
        row[col.code] = null
        break
    }
  }
  return row
}
