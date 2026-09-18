import type { TableColumnDef, TableRow } from './use-table-sync'

/**
 * Чистая модель useTableSync: построение пустой строки, стабильное сравнение
 * снимков и реконсиляция dirty→canon. Вынесено из use-table-sync.ts при
 * декомпозиции (2026-09-18), поведение 1:1. React-состояния и рефов здесь нет.
 */

/**
 * Префикс rowId локально добавленной строки — той, которой сервер ещё не видел.
 * Всё остальное — серверные rowId (после save приходит remap на реальные id).
 * Нужна в двух местах: где строка создаётся (buildEmptyRow) и где фильтруется
 * при реконсиляции dirty→merged — раньше префикс был захардкожен в первом и НЕ
 * читался во втором, из-за чего серверная строка воскресала дублем.
 */
export const TMP_ROW_ID_PREFIX = 'tmp-'

export function buildEmptyRow(columns: TableColumnDef[]): TableRow {
  const row: TableRow = { rowId: `${TMP_ROW_ID_PREFIX}${crypto.randomUUID()}` }
  for (const col of columns) {
    switch (col.dataType) {
      case 'STRING':
      case 'TEXT':
        row[col.binding] = ''
        break
      case 'INTEGER':
      case 'DECIMAL':
        row[col.binding] = 0
        break
      case 'BOOLEAN':
        row[col.binding] = false
        break
      default:
        row[col.binding] = null
        break
    }
  }
  return row
}

/**
 * Сериализация с сортировкой ключей — для сравнения «локальный снимок vs
 * отправленный». Обычный JSON.stringify считал бы расхождением разный порядок
 * ключей: локальная строка собирается спредом `{ ...r, [binding]: value }`, а
 * канон приходит с сервера в своём порядке. Ложное расхождение стоило бы
 * лишнего EVENT'а на каждом сохранении.
 */
export function stableStringify(value: unknown): string {
  // JSON.stringify(undefined) === undefined, а тип в lib.d.ts обещает string —
  // отсекаем явной веткой, иначе `?? 'null'` считается лишним и падает лint.
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(',')}}`
}

export function sameRows(a: TableRow[] | null, b: TableRow[] | null): boolean {
  return stableStringify(a) === stableStringify(b)
}

/**
 * Реконсиляция показа: наложение накопленных локальных правок (dirty) на
 * серверный канон. Ничего не шлёт и ничего не разрешает — этим заведует
 * drain() в use-table-sync.
 *
 * @param canon            серверный снимок строк
 * @param dirty            карта rowId → патч значений, которых сервер ещё не видел
 * @param readonlyBindings биндинги readonly-колонок: их значения приходят с
 *                         сервера, локальный патч по ним не применяется
 */
export function reconcileRows(
  canon: TableRow[],
  dirty: Map<string, Record<string, unknown>>,
  readonlyBindings: Set<string>
): TableRow[] {
  // Re-apply dirty snapshot over canon
  const merged = canon.map((row) => {
    const patch = dirty.get(row.rowId)
    if (!patch) return row
    const result = { ...row }
    for (const [key, val] of Object.entries(patch)) {
      // Skip readonly columns — those come from server
      if (!readonlyBindings.has(key)) {
        result[key] = val
      }
    }
    return result
  })

  // Keep rows that exist only locally (added while in-flight, with tmp- ids).
  // «Нет в каноне» ≠ «добавлена локально»: серверная строка выпадает из канона
  // и при перенумерации/пересборке ТЧ. Её патч приземлять некуда — отбрасываем,
  // а не превращаем в строку-дубль. Только tmp--строки достойны воскрешения.
  for (const [rowId, patch] of dirty) {
    if (!rowId.startsWith(TMP_ROW_ID_PREFIX)) continue
    if (canon.some((r) => r.rowId === rowId)) continue
    merged.push({ rowId, ...patch } as TableRow)
  }

  return merged
}
