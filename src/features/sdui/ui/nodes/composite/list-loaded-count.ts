type TranslateFn = (key: string, opts?: Record<string, unknown>) => string

/**
 * Метка счётчика строк. SEARCH-тракт возвращает Slice без totalElements —
 * тогда показываем «Загружено N» без «из M», иначе — с общим количеством.
 */
export function resolveLoadedCountLabel(
  t: TranslateFn,
  loaded: number,
  totalElements: number | undefined
): string {
  return typeof totalElements === 'number'
    ? t('table.loadedCount', { loaded, total: totalElements })
    : t('table.loadedCountNoTotal', { loaded })
}
