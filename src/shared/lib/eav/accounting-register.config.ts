import type { EavDomainConfig } from './domain-config'

export const ACCOUNTING_REGISTER_DOMAIN_CONFIG: EavDomainConfig = {
  queryKeyPrefix: 'accounting-register',
  baseUrl: '/api/accounting-register-entries',
  supportsQSearch: false,
}
