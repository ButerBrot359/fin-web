import { useEffect, useRef, type FC, type ReactNode } from 'react'

import type { ReadOnlyRowCommands } from '../../../lib/hooks/use-read-only-row-commands'
import { navestiFokusNaTablitsu } from '../../../lib/utils/table-keyboard-focus'
import { TableToolbar } from './table-toolbar'

const noop = () => undefined

/**
 * Обёртка read-only таблицы с props.tableCommands: командная панель — тот же
 * TableToolbar, что у редактируемых ТЧ (группы, «Ещё», requiresSelectedRow,
 * поиск), без строковых операций над данными (добавить/удалить/переместить —
 * у read-only таблицы их нет). Контейнер клавиатуры — как у ТЧ: хоткеи
 * слушает таблица, в которой фокус.
 */
export const ReadOnlyCommandFrame: FC<{
  rowCommands: ReadOnlyRowCommands
  children: ReactNode
}> = ({ rowCommands, children }) => {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const { selectedRowId } = rowCommands

  // Текущая строка всегда в кадре (↑/↓, поиск), как у TableBodyRow ТЧ;
  // block: 'nearest' — видимая строка на клик не двигается.
  useEffect(() => {
    if (selectedRowId === null) return
    const row = frameRef.current?.querySelector(
      `[data-sdui-ro-row-id="${CSS.escape(selectedRowId)}"]`
    )
    // typeof — jsdom метода не реализует
    if (row && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedRowId])

  return (
    <div
      ref={frameRef}
      tabIndex={-1}
      data-sdui-table-keyboard="true"
      style={{ outline: 'none' }}
      onKeyDown={rowCommands.handleKeyDown}
      onMouseDown={navestiFokusNaTablitsu}
    >
      <div style={{ marginBottom: 8 }}>
        <TableToolbar
          onAdd={noop}
          onMoveUp={noop}
          onMoveDown={noop}
          onRemove={noop}
          canAdd={false}
          canMoveUp={false}
          canMoveDown={false}
          canRemove={false}
          allowAdd={false}
          allowReorder={false}
          allowDelete={false}
          commands={rowCommands.commands}
          search={rowCommands.search}
          selectedRowId={selectedRowId}
        />
      </div>
      {children}
    </div>
  )
}
