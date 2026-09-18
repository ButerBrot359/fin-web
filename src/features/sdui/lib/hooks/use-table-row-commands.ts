import type { KeyboardEvent } from 'react'

import { createTableHotkeysHandler } from '../utils/table-hotkeys'
import { omitServiceRowKeys } from '../utils/service-row-keys'
import type {
  TableColumnDef,
  TableRow,
  UseTableSyncResult,
} from './use-table-sync'
import type { TableSearchApi } from './use-table-search'

/**
 * Команды строк редактируемой ТЧ: добавить/копировать/удалить/переместить,
 * can*-флаги для тулбара и обработчик хоткеев (SCRUM-302). Общая механика
 * EditableTable и ComplexEditableTable; различия селекции параметризованы явно.
 */
export interface UseTableRowCommandsParams {
  sync: Pick<UseTableSyncResult, 'rows' | 'addRow' | 'deleteRow' | 'moveRow'>
  /**
   * Колонки СИНХРОНИЗАЦИИ — все, включая скрытые: на них держатся ключи
   * master-detail и служебные значения, они обязаны попадать в новую строку.
   */
  columns: TableColumnDef[]
  /** Видимый (отфильтрованный отбором/master-detail) набор строк. */
  visibleRows: TableRow[]
  /** rowId выбранной строки; null — выбора нет. */
  selectedRowId: string | null
  /** Индекс выбранной строки в ВИДИМОМ наборе; -1 — выбора нет. */
  selectedVisibleIndex: number
  /**
   * «Добавить» — своя в каждой таблице: у complex это master-detail пресет +
   * автопереход SCRUM-363, у editable — голый addRow.
   */
  onAdd: () => void
  /** Снять выделение после удаления строки. */
  clearSelection: () => void
  /**
   * Перевод ВИДИМОГО индекса в индекс полного массива для moveRow
   * (SCRUM-282 C1): editable считает его по rowId (отбор строк разрежает
   * набор), complex передаёт тождество — reorder там разрешён только вне
   * master-detail, где visibleRows === sync.rows.
   */
  globalIndexOf: (visibleIndex: number) => number
  /**
   * Сдвиг выделения вслед за перемещённой строкой. Нужен индексной селекции
   * (editable); rowId-селекция (complex) переезжает вместе со строкой сама —
   * параметр не передаётся.
   */
  onMoved?: (toVisibleIndex: number) => void
  search: Pick<TableSearchApi, 'focusInput' | 'clear'>
}

export interface UseTableRowCommandsResult {
  handleAdd: () => void
  handleCopy: () => void
  handleRemove: () => void
  handleMoveUp: () => void
  handleMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  canRemove: boolean
  canCopy: boolean
  handleKeyDown: (e: KeyboardEvent<HTMLElement>) => void
  /** Готовый проброс команд в TableToolbar (спред; частные флаги — поверх). */
  toolbarProps: {
    onAdd: () => void
    onCopy: () => void
    onRemove: () => void
    onMoveUp: () => void
    onMoveDown: () => void
    canMoveUp: boolean
    canMoveDown: boolean
    canRemove: boolean
    canCopy: boolean
  }
}

export function useTableRowCommands({
  sync,
  columns,
  visibleRows,
  selectedRowId,
  selectedVisibleIndex,
  onAdd,
  clearSelection,
  globalIndexOf,
  onMoved,
  search,
}: UseTableRowCommandsParams): UseTableRowCommandsResult {
  const handleAdd = onAdd

  // Удаляем по rowId из ПОЛНОГО массива sync.rows (SCRUM-282 C1): видимый
  // индекс указывает на позицию в отфильтрованном visibleRows и не годится
  // для sync.deleteRow.
  const handleRemove = () => {
    if (selectedRowId === null) return
    const globalIndex = sync.rows.findIndex((r) => r.rowId === selectedRowId)
    if (globalIndex >= 0) sync.deleteRow(globalIndex)
    clearSelection()
  }

  // Копия строки: существующий addRow с пресетами из выбранной строки (без
  // rowId — buildEmptyRow сгенерирует новый tmp-id). Ссылочные ячейки
  // {id, presentation} копируются как есть, служебные ключи — нет: состояние
  // посчитано бэком для строки-источника и к копии не относится — без очистки
  // копия заблокированной строки приезжала бы заблокированной ещё до ответа
  // сервера (см. service-row-keys).
  const handleCopy = () => {
    if (selectedRowId === null) return
    const src = sync.rows.find((r) => r.rowId === selectedRowId)
    if (!src) return
    const { rowId: _rowId, ...values } = omitServiceRowKeys(src)
    sync.addRow(columns, values)
  }

  // Соседом считается соседняя ВИДИМАЯ строка: при активном отборе строки
  // между ними принадлежат другим сотрудникам, и перестановка через них
  // сдвинула бы чужие данные.
  const handleMoveUp = () => {
    if (selectedVisibleIndex <= 0) return
    const from = globalIndexOf(selectedVisibleIndex)
    const to = globalIndexOf(selectedVisibleIndex - 1)
    if (from < 0 || to < 0) return
    sync.moveRow(from, to)
    onMoved?.(selectedVisibleIndex - 1)
  }
  const handleMoveDown = () => {
    if (
      selectedVisibleIndex < 0 ||
      selectedVisibleIndex >= visibleRows.length - 1
    )
      return
    const from = globalIndexOf(selectedVisibleIndex)
    const to = globalIndexOf(selectedVisibleIndex + 1)
    if (from < 0 || to < 0) return
    sync.moveRow(from, to)
    onMoved?.(selectedVisibleIndex + 1)
  }

  const handleKeyDown = createTableHotkeysHandler({
    onAdd: handleAdd,
    onCopy: handleCopy,
    onRemove: handleRemove,
    onMoveUp: handleMoveUp,
    onMoveDown: handleMoveDown,
    onFocusSearch: search.focusInput,
    onClearSearch: search.clear,
  })

  const canMoveUp = selectedVisibleIndex > 0
  const canMoveDown =
    selectedVisibleIndex >= 0 && selectedVisibleIndex < visibleRows.length - 1
  const canRemove = selectedRowId !== null
  const canCopy = selectedRowId !== null

  return {
    handleAdd,
    handleCopy,
    handleRemove,
    handleMoveUp,
    handleMoveDown,
    canMoveUp,
    canMoveDown,
    canRemove,
    canCopy,
    handleKeyDown,
    toolbarProps: {
      onAdd: handleAdd,
      onCopy: handleCopy,
      onRemove: handleRemove,
      onMoveUp: handleMoveUp,
      onMoveDown: handleMoveDown,
      canMoveUp,
      canMoveDown,
      canRemove,
      canCopy,
    },
  }
}
