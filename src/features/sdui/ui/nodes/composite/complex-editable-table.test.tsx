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

const mockDispatch = vi.fn<(action: unknown) => Promise<boolean>>(() =>
  Promise.resolve(true),
)
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
    allowAdd: true,
    allowDelete: true,
    allowReorder: true,
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

// Master-таблица с серверной реакцией на активацию строки (table.rowActivate):
// бэк точечно добавил второй action у ТЧ с props.rowActivate === true.
const activateBehavior = {
  flushPendingTables: false,
  resetsDirty: false,
  closeAfter: false,
}

const masterNode: ViewNode = {
  id: 'table.vychetyIPN',
  type: 'TABLE',
  binding: 'VychetyIPN',
  props: { editable: true, allowAdd: true, rowActivate: true },
  actions: [
    { trigger: 'change', actionId: 'fieldEvent' },
    {
      trigger: 'activate',
      actionId: 'command',
      command: 'table.rowActivate:VychetyIPN',
      behavior: activateBehavior,
    },
  ],
  children: [
    { id: 'col-vychet', type: 'TABLE_COLUMN', binding: 'VychetIPN', props: { label: 'Вычет' } },
  ],
} as ViewNode

const commandCalls = () =>
  mockDispatch.mock.calls.filter(
    (call) => (call[0] as { type: string }).type === 'COMMAND',
  )

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

describe('ComplexEditableTable — активация строки (table.rowActivate)', () => {
  it('клик по строке шлёт готовую команду бэка с rowId и немутирующим behavior', () => {
    render(<ComplexEditableTable node={masterNode} />)

    fireEvent.click(screen.getByText('B'))

    expect(commandCalls()).toHaveLength(1)
    expect(commandCalls()[0]).toEqual([
      {
        type: 'COMMAND',
        command: 'table.rowActivate:VychetyIPN',
        value: { rowId: 'm2' },
      },
      activateBehavior,
    ])
  })

  it('клик по строке по-прежнему публикует выбор для master-detail фильтра', () => {
    render(<ComplexEditableTable node={masterNode} />)

    fireEvent.click(screen.getByText('B'))

    expect(state['VychetyIPN.__selectedRowId']).toBe('m2')
  })

  it('повторный клик по активной строке нового запроса не даёт', () => {
    render(<ComplexEditableTable node={masterNode} />)

    fireEvent.click(screen.getByText('A'))
    fireEvent.click(screen.getByText('A'))

    expect(commandCalls()).toHaveLength(1)
  })

  it('без action activate клик по строке на сервер не ходит', () => {
    state['VychetyIPN.__selectedRowId'] = 'm1'
    render(<ComplexEditableTable node={detailNode} />)

    fireEvent.click(screen.getByText('Row dA1'))

    expect(commandCalls()).toHaveLength(0)
  })

  it('setProp allowAdd=false перерисовывает тулбар, а не читается один раз при монтировании', () => {
    const { rerender } = render(<ComplexEditableTable node={masterNode} />)
    expect(screen.queryByRole('button', { name: 'table.add' })).not.toBeNull()

    // Ровно то, что делает applyTreePatches: новый объект узла с новыми props
    const patched = {
      ...masterNode,
      props: { ...masterNode.props, allowAdd: false },
    } as ViewNode
    rerender(<ComplexEditableTable node={patched} />)

    expect(screen.queryByRole('button', { name: 'table.add' })).toBeNull()
  })
})

describe('ComplexEditableTable — «Добавить» у detail-ТЧ при запрете правилом', () => {
  // Эталон 1С: кнопка остаётся активной, а причину объясняет сервер (снимает
  // строку + notify). Правило — доменное знание сервера, клиент его не считает.
  const deniedNode = {
    ...detailNode,
    props: { ...detailNode.props, allowAdd: false },
  } as ViewNode

  it('allowAdd=false у detail-ТЧ не прячет и не гасит кнопку', () => {
    state['VychetyIPN.__selectedRowId'] = 'm1'
    render(<ComplexEditableTable node={deniedNode} />)

    const addButton = screen.getByRole('button', { name: 'table.add' })
    expect(addButton.hasAttribute('disabled')).toBe(false)
  })

  it('клик по «Добавить» уходит на сервер — ответом придёт notify с причиной', () => {
    state['VychetyIPN.__selectedRowId'] = 'm1'
    render(<ComplexEditableTable node={deniedNode} />)

    fireEvent.click(screen.getByRole('button', { name: 'table.add' }))

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'EVENT',
        sourceNodeId: 'detailTbl',
        fullSnapshot: true,
      }),
    )
  })
})
