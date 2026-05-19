import type { DocumentAttribute } from '@/entities/document-type'

// Per-type synthetic attributes prepended to backend metadata for the
// dictionary list view. Used when the backend type schema omits an
// attribute (or marks it showInList=false) while the value is reliably
// present in every entry payload.
//
// TODO: remove an entry here once the corresponding backend metadata is
// fixed (showInList=true on the real attribute).
const SYNTHETIC_ATTRIBUTES: Record<string, DocumentAttribute[]> = {
  'DICTIONARY:Kassy': [
    {
      id: -1,
      code: 'Vladelets',
      code1C: '',
      nameRu: 'Владелец',
      nameKz: 'Иесі',
      dataType: 'DICTIONARY',
      domainKind: 'DICTIONARY',
      isRequired: false,
      readonly: false,
      maxLength: null,
      referenceTypeCode: 'Organizatsii',
      referenceSelectionMode: '',
      sortOrder: 0,
      tableSortOrder: 0,
      showInList: true,
      showInForm: false,
      defaultValue: null,
      formEvent: null,
    },
  ],
}

export const mergeAttributeOverrides = (
  domain: string,
  typeCode: string,
  attributes: DocumentAttribute[]
): DocumentAttribute[] => {
  const synthetic = SYNTHETIC_ATTRIBUTES[`${domain}:${typeCode}`]
  if (!synthetic) return attributes

  const existing = new Set(attributes.map((a) => a.code))
  const additions = synthetic.filter((a) => !existing.has(a.code))
  return additions.length > 0 ? [...attributes, ...additions] : attributes
}
