import type {
  ReportAltFilterFieldDto,
  ReportAltGroupingSelectionDto,
  ReportAltMetaDto,
  ReportAltSelectedFieldDto,
  ReportAltSelectionKind,
  ReportAltUserFilterDto,
  ReportAltUserOrderDto,
  ReportAltUserSettingsDto,
} from '../../types/reportalt'

/**
 * Клиентская модель пользовательских настроек отчёта ReportAlt
 * (settings-design.md §3/§7, F-S1): личная дельта в MVP живёт ТОЛЬКО на
 * клиенте — URL query (`us`) + localStorage — и уходит inline полем
 * `userSettings` в `POST /run`. Секция = null/отсутствует ⇒ наследуется из
 * варианта (сервер применяет вариант как есть).
 */

/** Ключ query-параметра URL с сериализованной дельтой настроек. */
export const SETTINGS_URL_KEY = 'us'

/** Примитивное значение строки отбора. */
export type SettingsFilterValue = number | string | boolean

/** Строка вкладки «Отборы» (UI-модель; в DTO values сворачиваются в value). */
export interface SettingsFilterRow {
  field: string
  comparison: string
  values: SettingsFilterValue[]
  use: boolean
}

/** Пользовательская дельта настроек (редактируемая модель панели). */
export interface ReportAltSettingsState {
  selectedFields?: ReportAltSelectedFieldDto[] | null
  filters?: SettingsFilterRow[] | null
  order?: ReportAltUserOrderDto[] | null
  grouping?: ReportAltGroupingSelectionDto | null
  appearanceFlags?: Record<string, boolean> | null
}

/** Есть ли у отчёта что настраивать (meta наполнен ⇔ handler adopted, F-S3). */
export const hasSettingsSupport = (meta: ReportAltMetaDto | null): boolean =>
  meta != null &&
  ((meta.availableFields?.length ?? 0) > 0 ||
    (meta.availableGroupings?.length ?? 0) > 0 ||
    (meta.filters?.length ?? 0) > 0)

/** Пуста ли группировка (ничего не выбрано — наследуем вариант). */
const isEmptyGrouping = (g: ReportAltGroupingSelectionDto | null): boolean =>
  g == null ||
  (g.presetCode == null && Object.keys(g.toggles ?? {}).length === 0)

/** Пустая ли дельта (⇒ действуют стандартные настройки варианта). */
export const isEmptySettings = (s: ReportAltSettingsState | null): boolean =>
  s == null ||
  ((s.selectedFields == null || s.selectedFields.length === 0) &&
    (s.filters == null || s.filters.length === 0) &&
    (s.order == null || s.order.length === 0) &&
    isEmptyGrouping(s.grouping ?? null) &&
    (s.appearanceFlags == null || Object.keys(s.appearanceFlags).length === 0))

/** Сравнения-«списки»: значение — массив (В списке / Не в списке). */
export const comparisonIsMulti = (comparison: string): boolean =>
  comparison === 'IN_LIST' || comparison === 'NOT_IN_LIST'

/** Требует ли сравнение значения (FILLED/NOT_FILLED — нет). */
export const comparisonNeedsValue = (comparison: string): boolean =>
  comparison !== 'FILLED' && comparison !== 'NOT_FILLED'

const REF_COMPARISONS = [
  'EQUAL',
  'NOT_EQUAL',
  'IN_LIST',
  'NOT_IN_LIST',
  'FILLED',
  'NOT_FILLED',
]
const ORDERING_COMPARISONS = [
  'EQUAL',
  'NOT_EQUAL',
  'GREATER',
  'GREATER_OR_EQUAL',
  'LESS',
  'LESS_OR_EQUAL',
]

/**
 * Фолбэк-каталог сравнений по типу поля (зеркало серверного
 * `ComparisonCatalog`, settings-design §4.4) — на случай, когда meta не
 * прислала `comparisons` по полю.
 */
const COMPARISONS_BY_TYPE: Partial<Record<string, string[]>> = {
  DICTIONARY_REF: REF_COMPARISONS,
  ACCOUNT_REF: REF_COMPARISONS,
  ENUM_REF: REF_COMPARISONS,
  ACCOUNT_LIST: REF_COMPARISONS,
  REF_LIST: REF_COMPARISONS,
  STRING: ['EQUAL', 'NOT_EQUAL', 'CONTAINS', 'FILLED', 'NOT_FILLED'],
  NUMBER: ORDERING_COMPARISONS,
  DATE: ORDERING_COMPARISONS,
  PERIOD: ORDERING_COMPARISONS,
  BOOLEAN: ['EQUAL', 'NOT_EQUAL'],
}

const DEFAULT_COMPARISON_BY_TYPE: Partial<Record<string, string>> = {
  STRING: 'CONTAINS',
  DATE: 'GREATER_OR_EQUAL',
  PERIOD: 'GREATER_OR_EQUAL',
}

/** Допустимые сравнения поля отбора: из meta, иначе — фолбэк по типу. */
export const comparisonsForField = (
  field: ReportAltFilterFieldDto
): string[] =>
  field.comparisons?.length
    ? field.comparisons
    : (COMPARISONS_BY_TYPE[field.valueType ?? ''] ?? REF_COMPARISONS)

/** Сравнение по умолчанию для поля отбора. */
export const defaultComparisonForField = (
  field: ReportAltFilterFieldDto
): string =>
  field.defaultComparison ??
  DEFAULT_COMPARISON_BY_TYPE[field.valueType ?? ''] ??
  comparisonsForField(field)[0]

/**
 * Дефолтные строки вкладки «Поля» при отсутствии дельты: все
 * availableAsColumn-поля включены + маркер «Авто» в конце. meta не отдаёт
 * слепок selection варианта (открытый вопрос стыка), поэтому дефолт —
 * «все поля + Авто».
 */
export const defaultFieldRows = (
  meta: ReportAltMetaDto
): ReportAltSelectedFieldDto[] => [
  ...(meta.availableFields ?? [])
    .filter((f) => f.availableAsColumn === true)
    .map<ReportAltSelectedFieldDto>((f) => ({
      kind: 'FIELD' as ReportAltSelectionKind,
      field: f.code,
      use: true,
    })),
  { kind: 'AUTO', use: true },
]

/** Готова ли строка отбора к отправке (есть значение, если оно требуется). */
const isFilterRowReady = (row: SettingsFilterRow): boolean =>
  !comparisonNeedsValue(row.comparison) || row.values.length > 0

/** DTO-значение строки отбора: список для IN_LIST, скаляр иначе. */
const filterRowValue = (row: SettingsFilterRow): unknown => {
  if (!comparisonNeedsValue(row.comparison)) return null
  if (comparisonIsMulti(row.comparison)) return row.values
  return row.values[0] ?? null
}

/**
 * Конвертация клиентской модели в контрактный `userSettings` для `/run`
 * (settings-design §3.1). Незаполненные строки отбора не отправляются
 * (остаются в URL/черновике).
 *
 * `selectedFields` уходит ПОЛНЫМ списком (все видимые use=true + скрытые
 * use=false): частичная дельта после серверного прунинга use=false даёт
 * пустую selection = «показать всё» (settings-design §7) — скрытие колонок
 * не сработает. AUTO-маркер сериализуется только когда он реально доливает
 * поля: use=true И среди `availableColumnCodes` есть код, не перечисленный
 * в списке явно. Иначе маркер опускается: сервер при развороте AUTO не
 * учитывает строки use=false как «перечисленные явно» и вернул бы скрытые
 * колонки обратно (наблюдалось живьём на OtchetPoProvodkam).
 */
export const toUserSettingsDto = (
  s: ReportAltSettingsState,
  schemaVersion?: number,
  availableColumnCodes?: string[]
): ReportAltUserSettingsDto => {
  const dto: ReportAltUserSettingsDto = {}
  if (schemaVersion != null) dto.schemaVersionRef = schemaVersion
  if (s.selectedFields != null && s.selectedFields.length > 0) {
    const explicit = new Set(
      s.selectedFields
        .filter((r) => r.kind === 'FIELD' && r.field != null)
        .map((r) => r.field)
    )
    // Доливает ли AUTO хоть одно поле; без каталога колонок — считаем, что
    // доливает (консервативно, поведение до фикса).
    const autoAddsSomething =
      availableColumnCodes == null ||
      availableColumnCodes.some((c) => !explicit.has(c))
    const rows = s.selectedFields.filter(
      (r) => r.kind !== 'AUTO' || (r.use && autoAddsSomething)
    )
    if (rows.length > 0) dto.selectedFields = rows
  }
  if (s.filters != null && s.filters.length > 0) {
    const rows = s.filters
      .filter(isFilterRowReady)
      .map<ReportAltUserFilterDto>((row) => ({
        field: row.field,
        comparison: row.comparison,
        value: filterRowValue(row),
        use: row.use,
      }))
    if (rows.length > 0) dto.filters = rows
  }
  if (s.order != null && s.order.length > 0) dto.order = s.order
  if (!isEmptyGrouping(s.grouping ?? null) && s.grouping != null) {
    dto.grouping = s.grouping
  }
  if (s.appearanceFlags != null && Object.keys(s.appearanceFlags).length > 0) {
    dto.appearanceFlags = s.appearanceFlags
  }
  return dto
}

// ── Сериализация URL (base64url от JSON — компактно и URL-safe) ────────────

/** Кодирует дельту для query-параметра `us`. */
export const encodeSettings = (s: ReportAltSettingsState): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(s))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Декодирует дельту из query-параметра; повреждённая строка ⇒ null. */
export const decodeSettings = (raw: string): ReportAltSettingsState | null => {
  try {
    const bin = atob(raw.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as ReportAltSettingsState
  } catch {
    return null
  }
}

// ── localStorage: личный дефолт при первом открытии отчёта (F-S1) ──────────

const storageKey = (code: string): string => `reportalt:${code}:settings`

/** Читает сохранённый личный дефолт настроек отчёта. */
export const loadStoredSettings = (
  code: string
): ReportAltSettingsState | null => {
  try {
    const raw = localStorage.getItem(storageKey(code))
    if (raw == null) return null
    const parsed: unknown = JSON.parse(raw)
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as ReportAltSettingsState
  } catch {
    return null
  }
}

/** Сохраняет (или при пустой дельте очищает) личный дефолт настроек. */
export const saveStoredSettings = (
  code: string,
  s: ReportAltSettingsState | null
): void => {
  try {
    if (s == null || isEmptySettings(s)) {
      localStorage.removeItem(storageKey(code))
    } else {
      localStorage.setItem(storageKey(code), JSON.stringify(s))
    }
  } catch {
    // localStorage недоступен (private mode) — личный дефолт не сохраняем.
  }
}

/** Очищает личный дефолт («Стандартные настройки»). */
export const clearStoredSettings = (code: string): void => {
  saveStoredSettings(code, null)
}
