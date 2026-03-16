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
  | 'OBJECT'

export const IGNORED_DATA_TYPES = new Set<DataType>(['TABLE', 'OBJECT'])

export const DICT_DATA_TYPES = new Set<DataType>([
  'DICTIONARY',
  'ACCOUNT_PLAN',
  'CHARACTERISTICS_PLAN',
  'DOCUMENT',
  'EXCHANGE_PLAN',
  'CALCULATION_PLAN',
  'ACCUMULATION_REGISTER',
  'INFORMATION_REGISTER',
])

const SEARCH_PATHS: Partial<Record<DataType, string>> = {
  DICTIONARY: '/api/dictionaries/entries',
  DOCUMENT: '/api/document-entries',
  CHARACTERISTICS_PLAN: '/api/characteristicsplan-entries',
  EXCHANGE_PLAN: '/api/exchangeplan-entries',
  CALCULATION_PLAN: '/api/calculationplan-entries',
  ACCOUNT_PLAN: '/api/accountplan-entries',
  ACCUMULATION_REGISTER: '/api/accumulation-register-entries',
  INFORMATION_REGISTER: '/api/information-register-entries',
}

export const getSearchUrl = (dataType: DataType, typeCode: string) => {
  const basePath = SEARCH_PATHS[dataType]
  if (!basePath) return null
  return `${basePath}/${typeCode}/search`
}

const TYPE_PATHS: Partial<Record<DataType, string>> = {
  DICTIONARY: '/api/dictionaries/types',
  DOCUMENT: '/api/document-types',
  CHARACTERISTICS_PLAN: '/api/characteristicsplan-types',
  EXCHANGE_PLAN: '/api/exchangeplan-types',
  CALCULATION_PLAN: '/api/calculationplan-types',
  ACCOUNT_PLAN: '/api/accountplan-types',
  ACCUMULATION_REGISTER: '/api/accumulation-register-types',
  INFORMATION_REGISTER: '/api/information-register-types',
}

export const getTypeUrl = (dataType: DataType, typeCode: string) => {
  const basePath = TYPE_PATHS[dataType]
  if (!basePath) return null
  return `${basePath}/${typeCode}`
}
