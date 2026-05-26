export type { EavDomainConfig } from './domain-config'
export type {
  ColumnMetaDto,
  EavColumnsResponseData,
  EavSearchResponseData,
  FilterCondition,
  FilterOp,
  FilterRequest,
  LogicOperator,
} from './types'

export { DOCUMENT_DOMAIN_CONFIG } from './document.config'
export { DICTIONARY_DOMAIN_CONFIG } from './dictionary.config'
export { INFORMATION_REGISTER_DOMAIN_CONFIG } from './information-register.config'
export { ACCUMULATION_REGISTER_DOMAIN_CONFIG } from './accumulation-register.config'
export { ACCOUNT_PLAN_DOMAIN_CONFIG } from './account-plan.config'

export { searchEavEntries, getEavColumns } from './api'
export type { EavSearchPageable } from './api'

export { useEavEntries } from './use-eav-entries'
export { useEavColumnsMeta } from './use-eav-columns-meta'
