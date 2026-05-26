import type { EavDomainConfig } from './domain-config'

export const ACCOUNT_PLAN_DOMAIN_CONFIG: EavDomainConfig = {
  queryKeyPrefix: 'account-plan',
  baseUrl: '/api/accountplan-entries',
  supportsQSearch: true,
}
