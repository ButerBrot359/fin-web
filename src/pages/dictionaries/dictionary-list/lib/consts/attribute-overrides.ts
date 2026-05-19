import type { DocumentAttribute } from '@/entities/document-type'

// Per-type attribute codes that should be forced into the dictionary
// list view regardless of what backend metadata sets for `showInList`.
// Useful when the attribute exists in the type schema but is flagged
// `showInList: false`, while the value is reliably present in every
// entry payload.
//
// TODO: drop an entry here once the corresponding backend metadata is
// fixed (the real attribute has `showInList: true`).
const FORCE_SHOW_IN_LIST: Record<string, ReadonlySet<string>> = {
  'DICTIONARY:Kassy': new Set(['Vladelets']),
}

export const mergeAttributeOverrides = (
  domain: string,
  typeCode: string,
  attributes: DocumentAttribute[]
): DocumentAttribute[] => {
  const forced = FORCE_SHOW_IN_LIST[`${domain}:${typeCode}`]
  if (!forced || forced.size === 0) return attributes

  return attributes.map((attr) =>
    forced.has(attr.code) && !attr.showInList
      ? { ...attr, showInList: true }
      : attr
  )
}
