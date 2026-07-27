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

/**
 * СПИСКИ документов + ссылочные пикеры, БЕЗ карточки (`['document-entry',…]`).
 *
 * Отдельный вариант нужен там, где карточка документа — источник изменения и уже
 * держит актуальные данные (после успешного сохранения форма ресетится
 * отправленными значениями, а свежий DTO кладётся в кэш из ответа мутации).
 * Инвалидация `['document-entry']` в этот момент попадает по ПРЕФИКСУ в активный
 * запрос `['document-entry', entryId]` и тянет повторный полный GET документа —
 * для ТЧ на ~1200 строк это второй тяжёлый round-trip и лишний ресет формы
 * сразу после и без того долгого сохранения.
 */
export const invalidateDocumentListQueries = (qc: QueryClient) => {
  void qc.invalidateQueries({ queryKey: ['document', 'entries'] }) // use-eav-entries список
  void qc.invalidateQueries({ queryKey: ['document-entries'] }) // прочие/легаси-ключи
  invalidateReferencePickers(qc)
}

/**
 * Кэши, зависящие от записей ДОКУМЕНТОВ (списки + карточка + ссылочные пикеры).
 * Для внешних по отношению к карточке мутаций (тулбар списка, SDUI-страница),
 * где данные карточки в кэше могли устареть.
 */
export const invalidateDocumentQueries = (qc: QueryClient) => {
  invalidateDocumentListQueries(qc)
  void qc.invalidateQueries({ queryKey: ['document-entry'] })
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
