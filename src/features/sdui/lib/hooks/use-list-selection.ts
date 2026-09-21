import { useEffect } from 'react'

import type { useSduiDispatch } from '../dispatch'
import { useSelectionStore } from '../stores/selection-store'
import type { ViewNodeAction } from '../../types/view'

interface UseListSelectionArgs {
  /** SCRUM-284 Δ4: ключ группы выбора — с selectAction, не из props. */
  selectAction: ViewNodeAction | undefined
  selectedRowId: number | null
  dispatch: ReturnType<typeof useSduiDispatch>
  nodeId: string
}

/**
 * Публикация выделенной строки LIST в shared-стор (для соседних кнопок
 * тулбара — ref.copy / ref.select) + отправка команды выбора строки.
 * Вынесено из list-node.tsx при декомпозиции (файл >300 строк), поведение 1:1.
 */
export function useListSelection({
  selectAction,
  selectedRowId,
  dispatch,
  nodeId,
}: UseListSelectionArgs) {
  const selectField = selectAction?.selectionField ?? undefined
  const setSelection = useSelectionStore((s) => s.setSelection)
  const clearSelection = useSelectionStore((s) => s.clearSelection)
  useEffect(() => {
    if (!selectField) return
    setSelection(selectField, selectedRowId)
    return () => {
      clearSelection(selectField)
    }
  }, [selectField, selectedRowId, setSelection, clearSelection])

  const dispatchSelect = (
    action: { command?: string } | undefined,
    rowId: number
  ) => {
    if (!action?.command) return
    void dispatch({
      type: 'COMMAND',
      command: action.command,
      value: { id: rowId },
      sourceNodeId: nodeId,
    })
  }

  return { dispatchSelect }
}
