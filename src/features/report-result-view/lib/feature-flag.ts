/** Ключ localStorage для принудительного переключения унифицированного рендерера. */
const STORAGE_KEY = 'unifiedReportRenderer'

/** Значения URL-параметра `renderer`, означающие явный опт-аут (старая таблица). */
const OPT_OUT_VALUES = new Set(['v1', 'v0', 'off', 'false', '0'])

/**
 * Включён ли унифицированный 1С-рендерер (`ReportResultView`) вместо старой
 * `ReportResultTable`. По умолчанию ВКЛЮЧЁН — отчёты отображаются «1 в 1 как в 1С».
 *
 * Выключить (откатиться на старую таблицу) можно двумя способами:
 * 1. URL-параметр `?renderer=v1` (или `off`/`false`/`0`) — на текущую вкладку;
 * 2. `localStorage.setItem('unifiedReportRenderer', 'false')` — постоянно.
 *
 * URL-параметр имеет приоритет над localStorage. `?renderer=v2` принудительно
 * включает рендерер, перебивая localStorage='false'.
 *
 * @param search строка query (`location.search`), напр. из `useLocation`.
 */
export const isUnifiedRendererEnabled = (search?: string): boolean => {
  // 1) URL-параметр имеет наивысший приоритет (явный опт-ин/опт-аут на вкладку).
  const query =
    search ?? (typeof window !== 'undefined' ? window.location.search : '')
  if (query) {
    const renderer = new URLSearchParams(query).get('renderer')
    if (renderer != null) {
      return !OPT_OUT_VALUES.has(renderer.toLowerCase())
    }
  }
  // 2) Постоянный опт-аут в localStorage ('false' выключает; 'true'/не задано — включён).
  try {
    if (
      typeof window !== 'undefined' &&
      window.localStorage.getItem(STORAGE_KEY) === 'false'
    ) {
      return false
    }
  } catch {
    /* localStorage недоступен — используем дефолт */
  }
  // 3) По умолчанию ВКЛЮЧЁН.
  return true
}
