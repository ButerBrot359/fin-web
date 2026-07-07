/**
 * Модель одной строки таблицы «Отборы» (вкладка настроек отчёта, СКД 1С).
 * Хранится в URL как JSON-массив; активные строки уходят в тело `/run`.
 */
export interface ReportFilterRow {
  /** Каноничный ключ поля (organizatsiya / subkonto:<code> и т.п.). */
  field: string
  /** ID вида субконто — routing-ключ для /run (только у субконто-полей). */
  kindId?: number
  /** Вид сравнения (код FilterComparison: EQUAL / NOT_EQUAL / …). */
  comparison: string
  /** Значения отбора (ID записей справочника/перечисления либо примитивы). */
  values: (number | string)[]
  /** Включён ли отбор (чекбокс строки): выключенный не уходит в /run. */
  enabled: boolean
}

/** Настройки вкладки «Оформление» (проброс в рендерер результата). */
export interface ReportAppearance {
  /** Выделять отрицательные значения красным (по умолчанию в 1С — вкл). */
  highlightNegatives: boolean
  /** Уменьшенный автоотступ уровней дерева (по умолчанию в 1С — вкл). */
  reducedIndent: boolean
}

/** Коды сравнений, не требующих значения (пикер значения скрывается). */
const VALUELESS_COMPARISONS = new Set(['FILLED', 'NOT_FILLED'])

/** Требует ли вид сравнения указания значения (для FILLED/NOT_FILLED — нет). */
export const comparisonNeedsValue = (comparison: string): boolean =>
  !VALUELESS_COMPARISONS.has(comparison)

/** Множественное сравнение (В списке / Не в списке) — пикер значений мультивыбор. */
export const comparisonIsMulti = (comparison: string): boolean =>
  comparison === 'IN_LIST' || comparison === 'NOT_IN_LIST'

/**
 * Готов ли отбор к применению (уйдёт в /run): включён и — если сравнение требует
 * значения — есть хотя бы одно значение.
 */
export const isFilterRowReady = (row: ReportFilterRow): boolean =>
  row.enabled &&
  (!comparisonNeedsValue(row.comparison) || row.values.length > 0)

/** RU-подписи видов сравнения СКД 1С. */
const COMPARISON_LABELS_RU: Partial<Record<string, string>> = {
  EQUAL: 'Равно',
  NOT_EQUAL: 'Не равно',
  IN_LIST: 'В списке',
  NOT_IN_LIST: 'Не в списке',
  IN_HIERARCHY: 'В иерархии',
  IN_GROUP: 'В группе',
  FILLED: 'Заполнено',
  NOT_FILLED: 'Не заполнено',
}

/** KZ-подписи видов сравнения. */
const COMPARISON_LABELS_KZ: Partial<Record<string, string>> = {
  EQUAL: 'Тең',
  NOT_EQUAL: 'Тең емес',
  IN_LIST: 'Тізімде',
  NOT_IN_LIST: 'Тізімде емес',
  IN_HIERARCHY: 'Иерархияда',
  IN_GROUP: 'Топта',
  FILLED: 'Толтырылған',
  NOT_FILLED: 'Толтырылмаған',
}

/** Человекочитаемая подпись вида сравнения (RU/KZ), фолбэк — сам код. */
export const comparisonLabel = (comparison: string, isKz: boolean): string =>
  (isKz
    ? COMPARISON_LABELS_KZ[comparison]
    : COMPARISON_LABELS_RU[comparison]) ?? comparison
