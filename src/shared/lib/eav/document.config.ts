import type { EavDomainConfig } from './domain-config'

export const DOCUMENT_DOMAIN_CONFIG: EavDomainConfig = {
  queryKeyPrefix: 'document',
  baseUrl: '/api/document-entries',
  supportsQSearch: true,
}
