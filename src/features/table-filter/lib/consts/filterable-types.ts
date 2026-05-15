/**
 * Whitelist `typeCode` документов, для которых включён UI серверной фильтрации.
 *
 * Расширение Phase 2 — добавить ещё один typeCode сюда после проверки на пилоте.
 */
export const FILTERABLE_DOCUMENT_TYPES: ReadonlySet<string> = new Set([
  'ZayavkaNaRegistratsiyuGPSdelki',
])

export const isFilterableDocumentType = (typeCode: string | undefined): boolean =>
  !!typeCode && FILTERABLE_DOCUMENT_TYPES.has(typeCode)
