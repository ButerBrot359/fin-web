/**
 * Конфиг EAV-домена для фильтрации списков (документы / справочники /
 * планы / регистры). Используется generic-хуками `useEavEntries` и
 * `useEavColumnsMeta` и компонентом `EavEntityTable`.
 *
 * Один объект конфига на домен — лежит рядом в этой же папке
 * (`document.config.ts`, `dictionary.config.ts`, ...).
 */
export interface EavDomainConfig {
  /**
   * Префикс react-query queryKey, чтобы кэши разных доменов не пересекались.
   * Пример: `'document'` → ключ `['document', 'entries', typeCode, ...]`.
   */
  queryKeyPrefix: string

  /**
   * Базовый URL контроллера, к которому добавляются `/{typeCode}/search` и
   * `/{typeCode}/columns`. Базы per-domain не унифицированы на бэке — см.
   * брифы Phase 2.1/2.2.
   *
   * Пример: `'/api/document-entries'` или `'/api/dictionaries/entries'`.
   */
  baseUrl: string

  /**
   * Поддерживает ли бэк `q`-поиск (full-text query параметр) на этом домене.
   * Регистры — `false`, остальные — `true`. На сегодня поле «Поиск» в
   * тулбарах списков не подключено к API; флаг оставлен на будущее, когда
   * `q`-поиск понадобится — generic-логика сможет учесть `false`.
   */
  supportsQSearch: boolean
}
