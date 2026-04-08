import type { DocumentAttribute } from '@/entities/document-type'

export const serializeTableRows = (
  attributes: Record<string, unknown>,
  documentAttributes: DocumentAttribute[]
): Record<string, unknown> => {
  const result = { ...attributes }

  for (const attr of documentAttributes) {
    if (attr.dataType !== 'TABLE') continue
    const rows = result[attr.code]
    if (!Array.isArray(rows)) continue

    result[attr.code] = rows.map(
      (row: Record<string, unknown>): Record<string, unknown> => {
        const serialized: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(row)) {
          if (key === '_rhfId') continue
          if (value && typeof value === 'object' && 'id' in value) {
            serialized[key] = (value as { id: number }).id
          } else {
            serialized[key] = value
          }
        }
        return serialized
      }
    )
  }

  return result
}
