import type { TFunction } from 'i18next'

/**
 * Метка счётчика строк. SEARCH-тракт возвращает Slice без totalElements —
 * тогда показываем «Загружено N» без «из M», иначе — с общим количеством.
 */
export function resolveLoadedCountLabel(
  t: TFunction,
  loaded: number,
  totalElements: number | undefined
): string {
  return typeof totalElements === 'number'
    ? t('table.loadedCount', { loaded, total: totalElements })
    : t('table.loadedCountNoTotal', { loaded })
}
