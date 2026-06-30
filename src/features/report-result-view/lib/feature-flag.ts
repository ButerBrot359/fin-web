/** Ключ localStorage для постоянного включения унифицированного рендерера. */
const STORAGE_KEY = 'unifiedReportRenderer'

/**
 * Включён ли унифицированный 1С-рендерер (`ReportResultView`) вместо старой
 * `ReportResultTable`. По умолчанию ВЫКЛЮЧЕН — старое поведение сохраняется.
 *
 * Включается двумя способами:
 * 1. URL-параметр `?renderer=v2` (на текущую вкладку, без сохранения);
 * 2. `localStorage.setItem('unifiedReportRenderer', 'true')` — постоянно.
 *
 * URL-параметр имеет приоритет: `?renderer=v1` (или любое значение, кроме
 * `v2`) принудительно выключает рендерер, перебивая localStorage.
 *
 * @param search строка query (`location.search`), напр. из `useLocation`.
 */
export const isUnifiedRendererEnabled = (search?: string): boolean => {
  // 1) URL-параметр имеет наивысший приоритет (явный опт-ин/опт-аут).
  const query =
    search ?? (typeof window !== 'undefined' ? window.location.search : '')
  if (query) {
    const renderer = new URLSearchParams(query).get('renderer')
    if (renderer != null) return renderer === 'v2'
  }
  // 2) Постоянный флаг в localStorage.
  try {
    return (
      typeof window !== 'undefined' &&
      window.localStorage.getItem(STORAGE_KEY) === 'true'
    )
  } catch {
    return false
  }
}
