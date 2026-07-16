import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { ComplexEditableTable } from './complex-editable-table'

// Компонентные тесты фикса SCRUM-282 (C1/I2): селекция по rowId вместо
// visible-индекса, чтобы delete/move не задевали чужую строку при активном
// master-detail фильтре.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: 'backend', init: () => {} },
}))

const mockDispatch = vi.fn(() => Promise.resolve(true))
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => mockDispatch,
}))

// Простой внешний стор сессии: getValue/setValue читают/пишут напрямую в state,
// useBindingValue делает то же самое — реактивность через rerender() после мутации.
const state: Record<string, unknown> = {}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    kind: 'panel',
    getSession: () => ({ formSessionId: null, revision: null }),
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

// Не тянем реальные виджеты ячеек — упрощённые ColumnDef по accessorKey/header.
vi.mock('../../../lib/utils/build-column-defs', () => ({
  buildColumnDefs: (children: ViewNode[] | undefined) =>
    (children ?? [])
      .filter((c) => c.type === 'TABLE_COLUMN')
      .map((c) => ({
        id: c.id,
        accessorKey: c.binding as string,
        header: (c.props?.label as string) ?? c.id,
      })),
  extractAllLeafColumns: () => [
    {
      id: 'col-vychet',
      label: 'Вычет',
      binding: 'VychetIPN',
      cellWidget: 'TEXT_FIELD',
      dataType: 'STRING',
      readonly: false,
      required: false,
      props: {},
    },
  ],
}))

// Detail-таблица: masterTable='VychetyIPN' (бинд мастер-строк), masterKey/detailKey='VychetIPN'
// (поле-ключ связи). node.binding='VychetyRows' — собственный массив строк detail-таблицы.
// Колонка 'label' — не связана с фильтрацией, нужна только чтобы различать строки в assert'ах.
const detailNode: ViewNode = {
  id: 'detailTbl',
  type: 'TABLE',
  binding: 'VychetyRows',
  props: {
    masterTable: 'VychetyIPN',
    masterKey: 'VychetIPN',
    detailKey: 'VychetIPN',
  },
  children: [
    { id: 'col-vychet', type: 'TABLE_COLUMN', binding: 'VychetIPN', props: { label: 'Вычет' } },
    { id: 'col-label', type: 'TABLE_COLUMN', binding: 'label', props: { label: 'Строка' } },
  ],
} as ViewNode

const masterRows = [
  { rowId: 'm1', VychetIPN: 'A' },
  { rowId: 'm2', VychetIPN: 'B' },
]

const detailRows = [
  { rowId: 'dA1', VychetIPN: 'A', label: 'Row dA1' },
  { rowId: 'dA2', VychetIPN: 'A', label: 'Row dA2' },
  { rowId: 'dB1', VychetIPN: 'B', label: 'Row dB1' },
]

beforeEach(() => {
  cleanup()
  for (const key of Object.keys(state)) delete state[key]
  mockDispatch.mockClear()
  mockDispatch.mockImplementation(() => Promise.resolve(true))
  state['VychetyIPN'] = masterRows
  state['VychetyRows'] = detailRows
})

describe('ComplexEditableTable — master-detail (SCRUM-282)', () => {
  it('фильтрует detail-строки по выбранной master-строке (реактивно на смену выбора)', () => {
    state['VychetyIPN.__selectedRowId'] = 'm2'
    const { rerender } = render(<ComplexEditableTable node={detailNode} />)

    expect(screen.getByText('Row dB1')).toBeTruthy()
    expect(screen.queryByText('Row dA1')).toBeNull()
    expect(screen.queryByText('Row dA2')).toBeNull()

    state['VychetyIPN.__selectedRowId'] = 'm1'
    rerender(<ComplexEditableTable node={detailNode} />)

    expect(screen.getByText('Row dA1')).toBeTruthy()
    expect(screen.getByText('Row dA2')).toBeTruthy()
    expect(screen.queryByText('Row dB1')).toBeNull()
  })

  it('блокирует «Добавить» без выбранной master-строки и разблокирует при выборе', () => {
    const { rerender } = render(<ComplexEditableTable node={detailNode} />)

    const addButton = screen.getByRole(
      'button',
      { name: 'table.add' },
    ) as HTMLButtonElement
    expect(addButton.disabled).toBe(true)

    state['VychetyIPN.__selectedRowId'] = 'm1'
    rerender(<ComplexEditableTable node={detailNode} />)

    expect(addButton.disabled).toBe(false)
  })

  it('регрессия C1: удаление при активном фильтре бьёт по правильной строке в полном массиве', () => {
    state['VychetyIPN.__selectedRowId'] = 'm2'
    render(<ComplexEditableTable node={detailNode} />)

    // Единственная видимая строка при выборе master B — dB1.
    fireEvent.click(screen.getByText('Row dB1'))

    const deleteButton = screen
      .getByTestId('DeleteOutlineIcon')
      .closest('button') as HTMLButtonElement
    expect(deleteButton).not.toBeNull()
    expect(deleteButton.disabled).toBe(false)
    fireEvent.click(deleteButton)

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'EVENT',
        sourceNodeId: 'detailTbl',
        fullSnapshot: true,
        value: expect.arrayContaining([
          expect.objectContaining({ rowId: 'dA1' }),
          expect.objectContaining({ rowId: 'dA2' }),
        ]),
      }),
    )
    const lastCall = mockDispatch.mock.calls.at(-1)?.[0] as {
      value: Array<{ rowId: string }>
    }
    expect(lastCall.value.some((r) => r.rowId === 'dB1')).toBe(false)
    expect(lastCall.value).toHaveLength(2)
  })
})
