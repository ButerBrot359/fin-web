import type { RefObject } from 'react'

import type { ViewAction } from '../../types/view'
import type { TableColumnDef, TableRow } from '../hooks/use-table-sync'

/**
 * Функция dispatch, какой её видит фабрика: структурный минимум, чтобы не
 * тянуть сюда весь `useSduiDispatch` (его полная сигнатура шире — behavior,
 * retry, opts — и здесь не нужна).
 */
export type ServerRefDispatch = (action: ViewAction) => Promise<boolean>

export interface ServerRefCommands {
  onServerShowAll?: () => void
  onServerCreate?: () => void
  onServerOpen?: () => void
}

/**
 * ADR-0029 Phase 2b: server-driven аффордансы пикера в ячейке ТЧ
 * (`showAll`/`create`/`open`) — trigger → COMMAND с координатой строки.
 *
 * dispatch приходит через ref, а НЕ захватом в мемоизированные колонки: он не
 * референциально стабилен (deps location/navigate/session/queryClient), и его
 * захват пересоздавал бы cell-рендер, роняя фокус в редактируемой ячейке —
 * тот же приём и та же причина, что у syncRef в таблицах.
 *
 * Команда в actions «голая» (один action на колонку, минтится при композиции,
 * когда строка ещё неизвестна) — координату строки добавляем здесь, в момент
 * клика. Нет action ⇒ undefined, и редактор ячейки уходит в легаси-пикер
 * (двойной путь, BL-2).
 *
 * Строки БЕЗ БД-id (только что добавленные) тоже идут серверным путём: бэк для
 * них не ищет строку, а возвращает значение эффектом без applyToParentCommand,
 * и его кладёт на место relay-selection → applyCellValueLocally. Раньше здесь
 * стоял откат на легаси — он делал SDUI недоступным в главном сценарии
 * (заполнить строку нельзя, а сохранить её без заполнения тоже нельзя).
 */
export function createServerRefCommands(
  dispatchRef: RefObject<ServerRefDispatch>,
  col: TableColumnDef,
  row: TableRow
): ServerRefCommands {
  const handler = (trigger: 'showAll' | 'create' | 'open') => {
    const command = col.actions?.find(
      (a) => a.trigger === trigger && a.actionId === 'command'
    )?.command
    if (!command) return undefined
    return () => {
      void dispatchRef.current({
        type: 'COMMAND',
        command,
        sourceNodeId: col.id,
        value: { rowId: row.rowId, row },
      })
    }
  }
  return {
    onServerShowAll: handler('showAll'),
    onServerCreate: handler('create'),
    onServerOpen: handler('open'),
  }
}
