import type { DocumentAttribute } from '@/entities/document-type'

// Per-(domain, typeCode) partial overrides applied on top of backend
// attribute metadata for the dictionary list view. Useful when the
// attribute exists in the type schema but is misconfigured (e.g.
// `showInList: false`, wrong `tableSortOrder`) while the value is
// reliably present in every entry payload.
//
// TODO: drop an entry here once the corresponding backend metadata is
// fixed.
const ATTRIBUTE_OVERRIDES: Record<
  string,
  Record<string, Partial<DocumentAttribute>>
> = {
  'DICTIONARY:Kassy': {
    // Show after `Kod` (tableSortOrder 1) but before `Naimenovaniya` (2).
    Vladelets: { showInList: true, tableSortOrder: 1.5 },
  },
}

export const mergeAttributeOverrides = (
  domain: string,
  typeCode: string,
  attributes: DocumentAttribute[]
): DocumentAttribute[] => {
  const overrides = ATTRIBUTE_OVERRIDES[`${domain}:${typeCode}`]
  if (!overrides) return attributes

  return attributes.map((attr) => {
    const override = overrides[attr.code]
    return override ? { ...attr, ...override } : attr
  })
}
