import { useEffect } from 'react'

import type { ViewNode } from '../../types/view'
import type { useSduiDispatch } from '../dispatch'

/**
 * SCRUM-308 §4.4: смена выделенной строки LIST уходит на сервер событием
 * `selectionChanged` — сервер отвечает патчами (панель контактов списка
 * «Пользователи»). Гейт — capability-паттерн SCRUM-362 B-1: событие шлётся
 * ТОЛЬКО если сервер положил в actions узла триггер `selectionChanged`;
 * на остальных ~120 списках домена лишнего трафика не появляется.
 * Снятие выделения (null) не шлём: контракт панели — «подпись выделенной
 * строки», пустое выделение сервер не адресует.
 */
export function useListSelectionEvent(
  node: ViewNode,
  selectedRowId: number | null,
  dispatch: ReturnType<typeof useSduiDispatch>
): void {
  const hasAction = !!node.actions?.some(
    (a) => a.trigger === 'selectionChanged'
  )
  useEffect(() => {
    if (!hasAction || selectedRowId == null) return
    void dispatch({
      type: 'EVENT',
      sourceNodeId: node.id,
      trigger: 'selectionChanged',
      value: { id: selectedRowId },
    })
    // dispatch стабилен (useCallback в use-sdui-dispatch), node.id — часть узла
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAction, selectedRowId, node.id])
}
