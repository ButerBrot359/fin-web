import { useEffect, useMemo, useRef } from 'react'

import { useSduiDispatch } from '../dispatch'
import type { CellRefHandlersFactory } from '../utils/build-column-defs'
import { createServerRefCommands } from '../utils/server-ref-commands'

/**
 * ADR-0029 Phase 2b: стабильная фабрика server-driven аффордансов пикера
 * ячейки ТЧ. dispatch берём через ref — он не референциально стабилен (deps
 * location/navigate/session/queryClient), и захват в мемоизированные колонки
 * пересоздавал бы cell-рендер, роняя фокус. Фабрика стабильна (deps []):
 * внутри читается только ref, значение — на момент клика.
 */
export function useCellRefHandlers(): CellRefHandlersFactory {
  const dispatch = useSduiDispatch()
  const dispatchRef = useRef(dispatch)
  // Пишем в эффекте, а не в теле рендера (react-hooks/refs): читатель —
  // обработчик клика, то есть заведомо после коммита (образец: use-table-sync).
  useEffect(() => {
    dispatchRef.current = dispatch
  })
  return useMemo<CellRefHandlersFactory>(
    () => (col, row) => createServerRefCommands(dispatchRef, col, row),
    []
  )
}
