import { cleanup, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { nodeToTableColumnDef } from '../../../lib/utils/build-column-defs'
import { EditableTable } from './editable-table'

// Ресайз колонок ТЧ: мастер-выключатель columnsResizable и применение ширин.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ru' } }),
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  initReactI18next: { type: 'backend', init: () => {} },
}))

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => vi.fn(() => Promise.resolve(true)),
}))

const state: Record<string, unknown> = {
  TMZ: [{ rowId: 'r1', Nomen: 'Гвозди' }],
}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    getValue: (b?: string) => (b ? state[b] : undefined),
    setValue: (b: string, v: unknown) => {
      state[b] = v
    },
    setFromServer: (b: string, v: unknown) => {
      state[b] = v
    },
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))

// Ячейки и тулбар в этом тесте не участвуют — упрощаем до текста.
vi.mock('./table-cell-editor', () => ({
  TableCellEditor: ({ value }: { value: unknown }) => (
    <span>{String(value)}</span>
  ),
}))
vi.mock('./table-toolbar', () => ({
  TableToolbar: () => null,
}))

const TABLE_ID = 'table.tmz'
const STATE_KEY = 'doc:PeremeshchenieTMZ.TMZ'

const columnNodes: ViewNode[] = [
  {
    id: `${TABLE_ID}.col.nomen`,
    type: 'TABLE_COLUMN',
    binding: 'Nomen',
    props: { label: 'Номенклатура', width: 240 },
  } as ViewNode,
  {
    id: `${TABLE_ID}.col.summa`,
    type: 'TABLE_COLUMN',
    binding: 'Summa',
    props: { label: 'Сумма', width: 100, resizable: false },
  } as ViewNode,
]

const makeNode = (props: Record<string, unknown>): ViewNode =>
  ({
    id: TABLE_ID,
    type: 'TABLE',
    binding: 'TMZ',
    props: { editable: true, ...props },
    children: columnNodes,
  }) as ViewNode

const renderTable = (props: Record<string, unknown>) =>
  render(
    <EditableTable
      node={makeNode(props)}
      columns={columnNodes.map(nodeToTableColumnDef)}
    />
  )

beforeEach(() => {
  cleanup()
  localStorage.clear()
})

describe('EditableTable — ресайз колонок', () => {
  // Регресс-пин: ресайз включается ТОЛЬКО контрактом бэка. Если ручки появятся
  // «по умолчанию», сломается вид всех уже работающих ТЧ (tableLayout:fixed).
  it('без columnsResizable ручек нет и раскладка не фиксируется', () => {
    const { container } = renderTable({})
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(0)
    // colgroup появляется только вместе с фиксированной раскладкой (sx MUI
    // едет классом emotion, поэтому проверяем именно наличие ширин).
    expect(container.querySelector('colgroup')).toBeNull()
  })

  it('с columnsResizable ручка есть у каждой разрешённой колонки', () => {
    const { container } = renderTable({
      columnsResizable: true,
      columnStateKey: STATE_KEY,
    })
    // Второй колонке бэк запретил ресайз (resizable: false) → одна ручка.
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(1)
    const handle = container.querySelector('[role="separator"]')
    expect(handle?.getAttribute('aria-orientation')).toBe('vertical')
    expect(screen.getByText('Гвозди')).toBeTruthy()
  })

  it('ширины с бэка и отклонение из localStorage попадают в colgroup', () => {
    localStorage.setItem(
      `sdui-col-widths:${STATE_KEY}`,
      JSON.stringify({ 'col.nomen': 400 })
    )
    const { container } = renderTable({
      columnsResizable: true,
      columnStateKey: STATE_KEY,
    })
    const cols = [...container.querySelectorAll('colgroup col')]
    expect(cols.map((c) => (c as HTMLElement).style.width)).toEqual([
      '400px',
      '100px',
    ])
  })
})
