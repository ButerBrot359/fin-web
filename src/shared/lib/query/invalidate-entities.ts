import type { QueryClient } from '@tanstack/react-query'

/**
 * Сброс кэшей после create/update/delete записей — чтобы изменения были видны
 * СРАЗУ, без ручной перезагрузки страницы. `invalidateQueries` помечает совпавшие
 * по ПРЕФИКСУ ключа запросы устаревшими: активные (открытый список/выпадашка)
 * рефетчатся немедленно, неактивные — при следующем маунте.
 *
 * ⚠️ Ключи ДОЛЖНЫ совпадать по префиксу с ключами запросов-консюмеров, иначе
 * инвалидация не срабатывает (частая причина «нужно обновить страницу»):
 *  - списки документов/справочников: `use-eav-entries` → `['document'|'dictionary','entries',…]`;
 *  - сайдбар справочника: `['dict-sidebar-entries',…]`;
 *  - legacy-пикер DictCell: `['dictionary-search',…]` (любой домен);
 *  - legacy field-опции: `['dictionary-entries-active',…]`.
 */

/**
 * Ссылочные пикеры/выпадашки читают записи любого домена (справочники, документы,
 * план счетов), поэтому сбрасываются при изменении записи ЛЮБОГО домена.
 */
export const invalidateReferencePickers = (qc: QueryClient) => {
  void qc.invalidateQueries({ queryKey: ['dictionary-search'] })
  void qc.invalidateQueries({ queryKey: ['dictionary-entries-active'] })
}

/** Кэши, зависящие от записей ДОКУМЕНТОВ (списки + ссылочные пикеры). */
export const invalidateDocumentQueries = (qc: QueryClient) => {
  void qc.invalidateQueries({ queryKey: ['document', 'entries'] }) // use-eav-entries список
  void qc.invalidateQueries({ queryKey: ['document-entries'] }) // прочие/легаси-ключи
  void qc.invalidateQueries({ queryKey: ['document-entry'] })
  invalidateReferencePickers(qc)
}

/** Кэши, зависящие от записей СПРАВОЧНИКОВ (страница-список, сайдбар, пикеры). */
export const invalidateDictionaryQueries = (qc: QueryClient) => {
  void qc.invalidateQueries({ queryKey: ['dictionary', 'entries'] }) // use-eav-entries список
  void qc.invalidateQueries({ queryKey: ['dict-entries'] }) // прочие/легаси-ключи
  void qc.invalidateQueries({ queryKey: ['dict-entry'] })
  void qc.invalidateQueries({ queryKey: ['dict-sidebar-entries'] }) // сайдбар
  void qc.invalidateQueries({ queryKey: ['dict-sidebar-entry'] })
  invalidateReferencePickers(qc)
}
