import type { EavDomainConfig } from './domain-config'

export const DICTIONARY_DOMAIN_CONFIG: EavDomainConfig = {
  queryKeyPrefix: 'dictionary',
  baseUrl: '/api/dictionaries/entries',
  supportsQSearch: true,
}
