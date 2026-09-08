import type { EavDomainConfig } from './domain-config'

export const INFORMATION_REGISTER_DOMAIN_CONFIG: EavDomainConfig = {
  queryKeyPrefix: 'information-register',
  baseUrl: '/api/information-register-entries',
  // Поиск по списку регистра: бэк строит предикат по колонкам списка (измерения,
  // ресурсы и представления ссылок) — у самой записи наименования нет.
  supportsQSearch: true,
}
