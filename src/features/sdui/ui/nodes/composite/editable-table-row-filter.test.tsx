import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { nodeToTableColumnDef } from '../../../lib/utils/build-column-defs'
import { EditableTable } from './editable-table'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ru' } }),
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  initReactI18next: { type: 'backend', init: () => {} },
}))

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => vi.fn(() => Promise.resolve(true)),
}))

const state: Record<string, unknown> = {}
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

vi.mock('./table-cell-editor', () => ({
  TableCellEditor: ({ value }: { value: unknown }) => (
    <span>{String(value)}</span>
  ),
}))

// Тулбар сведён к тому, что проверяется: подпись выбранной строки и «Удалить».
vi.mock('./table-toolbar', () => ({
  TableToolbar: ({
    onRemove,
    selectedRowId,
  }: {
    onRemove: () => void
    selectedRowId: string | null
  }) => (
    <div>
      <span data-testid="selected">{selectedRowId ?? ''}</span>
      <button type="button" onClick={onRemove}>
        Удалить
      </button>
    </div>
  ),
}))

const TABLE_ID = 'table.nachisleniya'

const columnNodes: ViewNode[] = [
  {
    id: `${TABLE_ID}.col.dolzhnost`,
    type: 'TABLE_COLUMN',
    binding: 'Dolzhnost',
    props: { label: 'Должность' },
  } as ViewNode,
]

const node = {
  id: TABLE_ID,
  type: 'TABLE',
  binding: 'Nachisleniya',
  props: {
    editable: true,
    filterSource: 'OtborSotrudnikov',
    filterSourceColumn: 'Sotrudnik',
    filterColumn: 'Sotrudnik',
  },
  children: columnNodes,
} as ViewNode

const ROWS = [
  { rowId: 'r1', Sotrudnik: { id: 1 }, Dolzhnost: 'ДИРЕКТОР' },
  { rowId: 'r2', Sotrudnik: { id: 2 }, Dolzhnost: 'БУХГАЛТЕР' },
  { rowId: 'r3', Sotrudnik: { id: 2 }, Dolzhnost: 'КАССИР' },
]

beforeEach(() => {
  cleanup()
  localStorage.clear()
  state['OtborSotrudnikov.__selectedRowId'] = undefined
  state.Nachisleniya = ROWS.map((r) => ({ ...r }))
  state.OtborSotrudnikov = [
    { rowId: 'o1', Sotrudnik: { id: 1 } },
    { rowId: 'o2', Sotrudnik: { id: 2 } },
  ]
})

const renderTable = () =>
  render(
    <EditableTable
      node={node}
      columns={columnNodes.map(nodeToTableColumnDef)}
    />
  )

// Порт 1С `ОтборСтрокТабЧастей`: панель отбора прячет чужие строки, но НЕ меняет
// саму табличную часть. Значит любая операция тулбара обязана попасть в ту строку,
// которую пользователь видит, а не в строку с тем же порядковым номером в полном
// наборе.
describe('EditableTable — отбор строк внешним списком', () => {
  it('без выбранной строки источника видны все строки', () => {
    renderTable()
    expect(screen.getByText('ДИРЕКТОР')).toBeTruthy()
    expect(screen.getByText('БУХГАЛТЕР')).toBeTruthy()
    expect(screen.getByText('КАССИР')).toBeTruthy()
  })

  it('выбран сотрудник — видны только его строки', () => {
    state['OtborSotrudnikov.__selectedRowId'] = 'o2'
    renderTable()
    expect(screen.queryByText('ДИРЕКТОР')).toBeNull()
    expect(screen.getByText('БУХГАЛТЕР')).toBeTruthy()
    expect(screen.getByText('КАССИР')).toBeTruthy()
  })

  it('выделение отдаёт rowId ВИДИМОЙ строки, а не строки с тем же номером', () => {
    state['OtborSotrudnikov.__selectedRowId'] = 'o2'
    renderTable()

    fireEvent.click(screen.getByText('БУХГАЛТЕР'))

    // Первая видимая строка — r2. Индексация по полному набору дала бы r1.
    expect(screen.getByTestId('selected').textContent).toBe('r2')
  })

  it('«Удалить» на первой видимой строке убирает её, а не первую строку полного набора', () => {
    state['OtborSotrudnikov.__selectedRowId'] = 'o2'
    renderTable()

    fireEvent.click(screen.getByText('БУХГАЛТЕР'))
    fireEvent.click(screen.getByText('Удалить'))

    const rows = state.Nachisleniya as { rowId: string }[]
    expect(rows.map((r) => r.rowId)).toEqual(['r1', 'r3'])
  })
})
