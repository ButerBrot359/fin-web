/**
 * Реестр локального применения значения в ячейку ТЧ (ADR-0029, ветка несохранённой строки).
 *
 * <p>Зачем. У только что добавленной строки нет БД-id, поэтому сервер её не ищет и не пишет:
 * он возвращает выбранный/созданный элемент эффектом с `applyToParentValue` и
 * `applyToParentTargetNodeId`, но БЕЗ `applyToParentCommand`. Отсутствие команды — протокольный
 * сигнал «родитель применяет сам». Применить может только та таблица, которая знает свою строку,
 * а `relay-selection` — общий модуль без доступа к конкретной ТЧ; отсюда реестр.
 *
 * <p>Приём зеркалит уже существующий `pending-table-commits`: таблица регистрирует функцию на
 * время жизни, общий код дергает её, не зная про таблицы ничего.
 *
 * <p>Почему НЕ через флаш в scratch: `CommandBehaviors` держит железное правило (PM-ревью) —
 * `flushPendingTables: true` допустим ТОЛЬКО у команды, которая scratch персистит. Пикер не
 * персистит, а флаш очищает `dirtyRef`, то есть уничтожил бы несохранённые правки ТЧ.
 */
type CellValueApplier = (
  columnNodeId: string,
  rowId: string,
  value: unknown
) => boolean

const registry = new Map<symbol, CellValueApplier>()

export function registerCellValueApplier(fn: CellValueApplier): symbol {
  const token = Symbol('cell-value-applier')
  registry.set(token, fn)
  return token
}

export function unregisterCellValueApplier(token: symbol): void {
  registry.delete(token)
}

/**
 * Раздаёт значение зарегистрированным таблицам, пока одна не признает колонку своей.
 * @returns `true`, если значение применено (нашлась таблица с такой колонкой).
 */
export function applyCellValueLocally(
  columnNodeId: string,
  rowId: string,
  value: unknown
): boolean {
  for (const applier of registry.values()) {
    if (applier(columnNodeId, rowId, value)) return true
  }
  return false
}

/**
 * Разбор `applyToParentTargetNodeId` вида `<colNodeId>#row=<rowId>`.
 * У несохранённой строки суффикса `@rev=` нет — пинить нечего (нет строки в БД).
 * @returns `null`, если адрес не в этой грамматике.
 */
export function parseCellTarget(
  targetNodeId: string | undefined | null
): { columnNodeId: string; rowId: string } | null {
  if (!targetNodeId) return null
  const marker = '#row='
  const at = targetNodeId.indexOf(marker)
  if (at < 0) return null
  const columnNodeId = targetNodeId.slice(0, at)
  // Отрезаем возможный хвост @rev=… — для локального применения он не нужен.
  const rowId = targetNodeId.slice(at + marker.length).split('@rev=')[0]
  if (!columnNodeId || !rowId) return null
  return { columnNodeId, rowId }
}
