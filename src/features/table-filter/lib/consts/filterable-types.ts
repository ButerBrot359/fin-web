/**
 * Per-domain whitelists `typeCode`, для которых включён UI серверной
 * фильтрации (иконки в шапке таблицы, чипы, попап).
 *
 * Расширение — добавляй typeCode после прохождения smoke на пилоте.
 */

export const FILTERABLE_DOCUMENT_TYPES: ReadonlySet<string> = new Set([
  'ZayavkaNaRegistratsiyuGPSdelki',
])

export const FILTERABLE_DICTIONARY_TYPES: ReadonlySet<string> = new Set([
  'Kontragenty',
])

export const FILTERABLE_INFORMATION_REGISTER_TYPES: ReadonlySet<string> =
  new Set<string>(['VychetyIPNFizicheskikhLits'])

export const isFilterableDocumentType = (
  typeCode: string | undefined
): boolean => !!typeCode && FILTERABLE_DOCUMENT_TYPES.has(typeCode)

export const isFilterableDictionaryType = (
  typeCode: string | undefined
): boolean => !!typeCode && FILTERABLE_DICTIONARY_TYPES.has(typeCode)

export const isFilterableInformationRegisterType = (
  typeCode: string | undefined
): boolean =>
  !!typeCode && FILTERABLE_INFORMATION_REGISTER_TYPES.has(typeCode)
