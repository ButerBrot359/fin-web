export type DataType =
  | 'STRING'
  | 'TEXT'
  | 'INTEGER'
  | 'DECIMAL'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATETIME'
  | 'DICTIONARY'
  | 'TABLE'
  | 'ENUMS'
  | 'ACCOUNT_PLAN'
  | 'CHARACTERISTICS_PLAN'
  | 'DOCUMENT'
  | 'EXCHANGE_PLAN'
  | 'CALCULATION_PLAN'
  | 'ACCUMULATION_REGISTER'
  | 'INFORMATION_REGISTER'
  | 'ACCOUNTING_REGISTER'
  | 'OBJECT'
  | 'DIRECTORY'

export const IGNORED_DATA_TYPES = new Set<DataType>(['OBJECT'])

export const REFERENCE_DOMAIN_KINDS = new Set([
  'DICTIONARY',
  'ACCOUNT_PLAN',
  'CHARACTERISTICS_PLAN',
  'DOCUMENT',
  'EXCHANGE_PLAN',
  'CALCULATION_PLAN',
  'ACCUMULATION_REGISTER',
  'INFORMATION_REGISTER',
  'ACCOUNTING_REGISTER',
])

const BASE = '/api/universaldomain-entries'
const TYPES_BASE = '/api/universaldomain-types'

export const getUniversalSearchUrl = (domain: string, typeCode: string) =>
  `${BASE}/${domain}/${typeCode}/search`

export const getUniversalPagedUrl = (domain: string, typeCode: string) =>
  `${BASE}/${domain}/${typeCode}/paged`

export const getUniversalEntriesUrl = (domain: string, typeCode: string) =>
  `${BASE}/${domain}/${typeCode}`

export const getUniversalEntryByIdUrl = (domain: string, id: number | string) =>
  `${BASE}/${domain}/id/${String(id)}`

export const getUniversalTypeUrl = (domain: string, code: string) =>
  `${TYPES_BASE}/${domain}/${code}`

const DIRECTORIES_BASE = '/api/universaldomain-directories'

export const getUniversalDirectoriesUrl = (domain: string, typeCode: string) =>
  `${DIRECTORIES_BASE}/${domain}/${typeCode}`

export const resolveAttributeDomain = (attr: {
  domainKind?: string | null
  allowedTypes?: { domainKind: string; typeCode: string }[]
}): { domain: string; typeCode: string } | null => {
  const first = attr.allowedTypes?.[0]
  if (!first) return null
  return { domain: first.domainKind, typeCode: first.typeCode }
}
