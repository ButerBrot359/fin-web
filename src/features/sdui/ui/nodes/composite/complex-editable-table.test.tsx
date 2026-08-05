import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { ComplexEditableTable } from './complex-editable-table'

// Компонентные тесты фикса SCRUM-282 (C1/I2): селекция по rowId вместо
// visible-индекса, чтобы delete/move не задевали чужую строку при активном
// master-detail фильтре.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'en' },
  }),
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  initReactI18next: { type: 'backend', init: () => {} },
}))

const mockDispatch = vi.fn<(action: unknown) => Promise<boolean>>(() =>
  Promise.resolve(true)
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
// SCRUM-291 §0.5 дефект 2: props.testEditable — тестовый маркер, который
// заводит ячейку через syncRef.current.updateCell (тот же путь, что и
// настоящий TableCellEditor) — нужен тестам 7/8, чтобы прогнать правку через
// обёртку updateCell компонента, а не только через клик по строке. Без
// маркера — старое поведение (голый текст), чтобы не задеть остальные тесты
// файла на getByText('A'/'B'): input не добавляет текстовый узел, а если бы
// подпись дублировалась текстом рядом с ним, getByText ловил бы «несколько
// совпадений».
vi.mock('../../../lib/utils/build-column-defs', () => ({
  // Реальное значение: из него компонент считает высоту строки (2 × под-строка).
  VERTICAL_SUB_ROW_HEIGHT: 36,
  buildColumnDefs: (
    children: ViewNode[] | undefined,
    syncRef: {
      current: {
        updateCell: (rowId: string, binding: string, value: unknown) => void
      } | null
    }
  ) =>
    (children ?? [])
      .filter((c) => c.type === 'TABLE_COLUMN')
      .map((c) => {
        const binding = c.binding!
        if (!c.props?.testEditable) {
          return {
            id: c.id,
            accessorKey: binding,
            header: c.props?.label ?? c.id,
          }
        }
        return {
          id: c.id,
          accessorKey: binding,
          header: c.props.label ?? c.id,
          cell: (info: { row: { original: Record<string, unknown> } }) => {
            const rowId = String(info.row.original.rowId)
            const cellValue = info.row.original[binding]
            return (
              <input
                data-testid={`editor-${binding}-${rowId}`}
                value={typeof cellValue === 'string' ? cellValue : ''}
                onChange={(e) =>
                  syncRef.current?.updateCell(rowId, binding, e.target.value)
                }
              />
            )
          },
        }
      }),
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
    {
      id: 'col-vychet',
      type: 'TABLE_COLUMN',
      binding: 'VychetIPN',
      props: { label: 'Вычет' },
    },
    {
      id: 'col-label',
      type: 'TABLE_COLUMN',
      binding: 'label',
      props: { label: 'Строка' },
    },
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
    {
      id: 'col-vychet',
      type: 'TABLE_COLUMN',
      binding: 'VychetIPN',
      props: { label: 'Вычет' },
    },
  ],
} as ViewNode

// SCRUM-291 §0.5 дефект 2: узел с редактируемой (testEditable) колонкой —
// отдельный от masterNode/detailNode выше, чтобы правка ячейки этого узла не
// задевала их getByText('A'/'B')-тесты. node.binding='Defect2Table' — свой
// канон, не пересекается с VychetyIPN/VychetyRows.
const defect2Node: ViewNode = {
  id: 'table.defect2',
  type: 'TABLE',
  binding: 'Defect2Table',
  props: { editable: true, allowDelete: true },
  children: [
    {
      id: 'col-vychet',
      type: 'TABLE_COLUMN',
      binding: 'VychetIPN',
      props: { label: 'Вычет' },
    },
    {
      id: 'col-vychet-edit',
      type: 'TABLE_COLUMN',
      binding: 'VychetIPN',
      props: { label: 'Вычет (edit)', testEditable: true },
    },
  ],
} as ViewNode

const commandCalls = () =>
  mockDispatch.mock.calls.filter(
    (call) => (call[0] as { type: string }).type === 'COMMAND'
  )

// «Удалить» гейтится ровно по selectedRowId (canRemove={selectedRowId !== null})
// — читаем aria-disabled пункта меню как прокси локального состояния выделения,
// не полагаясь только на CSS-класс выбранной строки.
const isDeleteDisabled = () => {
  fireEvent.click(screen.getByRole('button', { name: 'table.more' }))
  const deleteItem = screen.getByText('table.deleteRow')
  return deleteItem.closest('li')?.getAttribute('aria-disabled') === 'true'
}

beforeEach(() => {
  cleanup()
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  for (const key of Object.keys(state)) delete state[key]
  mockDispatch.mockClear()
  mockDispatch.mockImplementation(() => Promise.resolve(true))
  state.VychetyIPN = masterRows
  state.VychetyRows = detailRows
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

    const addButton = screen.getByRole<HTMLButtonElement>('button', {
      name: 'table.add',
    })
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

    fireEvent.click(screen.getByRole('button', { name: 'table.more' }))
    const deleteItem = screen.getByText('table.deleteRow')
    expect(deleteItem.closest('li')?.getAttribute('aria-disabled')).toBeNull()
    fireEvent.click(deleteItem)

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'EVENT',
        sourceNodeId: 'detailTbl',
        fullSnapshot: true,
        value: expect.arrayContaining([
          expect.objectContaining({ rowId: 'dA1' }),
          expect.objectContaining({ rowId: 'dA2' }),
        ]),
      })
    )
    const lastCall = mockDispatch.mock.calls.at(-1)?.[0] as {
      value: { rowId: string }[]
    }
    expect(lastCall.value.some((r) => r.rowId === 'dB1')).toBe(false)
    expect(lastCall.value).toHaveLength(2)
  })
})

describe('ComplexEditableTable: tableCommands (SCRUM-302)', () => {
  it('рендерит доменную кнопку из props.tableCommands', () => {
    const nodeWithCommands = {
      ...detailNode,
      props: {
        ...detailNode.props,
        tableCommands: [
          {
            command: 'table.podbor:VychetyIPN',
            label: 'Подбор',
            enabled: true,
            behavior: { flushPendingTables: false },
            inMoreMenu: true,
          },
        ],
      },
    } as ViewNode
    render(<ComplexEditableTable node={nodeWithCommands} />)
    expect(screen.getByRole('button', { name: 'Подбор' })).toBeTruthy()
  })
})

describe('ComplexEditableTable: копирование строки (SCRUM-302)', () => {
  it('«Скопировать» добавляет строку со значениями выбранной, без rowId', () => {
    state['VychetyIPN.__selectedRowId'] = 'm1'
    render(<ComplexEditableTable node={detailNode} />)
    // выбрать строку dA1
    fireEvent.click(screen.getByText('Row dA1'))
    fireEvent.click(screen.getByRole('button', { name: 'table.more' }))
    fireEvent.click(screen.getByText('table.copyRow'))
    // addRow шлёт EVENT полным снимком: последняя строка — копия dA1
    const call = mockDispatch.mock.calls.at(-1)?.[0] as {
      type: string
      value: { rowId: string; label?: unknown }[]
    }
    expect(call.type).toBe('EVENT')
    const added = call.value.at(-1)
    expect(added?.label).toBe('Row dA1')
    expect(added?.rowId).not.toBe('dA1')
  })
})

describe('ComplexEditableTable: поиск (SCRUM-302)', () => {
  it('поиск подсвечивает, но НЕ фильтрует строки', () => {
    state['VychetyIPN.__selectedRowId'] = 'm1'
    render(<ComplexEditableTable node={detailNode} />)
    fireEvent.change(screen.getByPlaceholderText('table.searchPlaceholder'), {
      target: { value: 'dA2' },
    })
    // обе видимые строки на месте — включая несовпадающую
    expect(screen.getByText('Row dA1')).toBeTruthy()
    expect(screen.getByText('Row dA2')).toBeTruthy()
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
      })
    )
  })
})

// SCRUM-291 §0.5 дефект 2: master-detail показывает чужой график после
// пересборки. Прувпойнт — ИПН: rowId у части типов документов — порядковый
// номер строки, не устойчивая идентичность записи; после пересборки ТЧ
// строка с тем же rowId в visibleRows, как правило, по-прежнему есть — но
// это уже другая запись.
describe('ComplexEditableTable — сброс выделения при подмене записи (SCRUM-291 §0.5 дефект 2)', () => {
  beforeEach(() => {
    state.Defect2Table = [
      { rowId: 'r1', VychetIPN: 'A' },
      { rowId: 'r2', VychetIPN: 'B' },
    ]
  })

  it('сбрасывает выбор при подмене записи под тем же rowId — и локально, и в публикации', () => {
    const { rerender } = render(<ComplexEditableTable node={defect2Node} />)

    fireEvent.click(screen.getByText('B'))
    expect(state['Defect2Table.__selectedRowId']).toBe('r2')

    // «Пересборка» сервером: канон с тем же rowId r2, но другим содержимым.
    state.Defect2Table = [
      { rowId: 'r1', VychetIPN: 'A' },
      { rowId: 'r2', VychetIPN: 'C' },
    ]
    rerender(<ComplexEditableTable node={defect2Node} />)

    // Публикация в сторе снята — ровно то, что раньше НЕ снималось (симптом
    // дефекта: detail фильтровал по опубликованному значению).
    expect(state['Defect2Table.__selectedRowId']).toBeNull()
    // И локальное выделение снято тоже — не только визуальный класс строки.
    expect(isDeleteDisabled()).toBe(true)
  })

  it('сохраняет выбор при повторном каноне с тем же содержимым строки', () => {
    const { rerender } = render(<ComplexEditableTable node={defect2Node} />)

    fireEvent.click(screen.getByText('B'))
    expect(state['Defect2Table.__selectedRowId']).toBe('r2')

    // Новый массив/объекты — обычное эхо после table-EVENT, содержимое то же.
    state.Defect2Table = [
      { rowId: 'r1', VychetIPN: 'A' },
      { rowId: 'r2', VychetIPN: 'B' },
    ]
    rerender(<ComplexEditableTable node={defect2Node} />)

    expect(state['Defect2Table.__selectedRowId']).toBe('r2')
    expect(isDeleteDisabled()).toBe(false)
  })

  it('сохраняет выбор при правке ячейки выбранной строки через updateCell', () => {
    render(<ComplexEditableTable node={defect2Node} />)

    fireEvent.click(screen.getByText('B'))
    expect(state['Defect2Table.__selectedRowId']).toBe('r2')

    fireEvent.change(screen.getByTestId('editor-VychetIPN-r2'), {
      target: { value: 'B2' },
    })

    // Не слетело на собственный ввод — иначе обе редактируемые таблицы ИПН
    // теряли бы выделение на каждый введённый символ.
    expect(state['Defect2Table.__selectedRowId']).toBe('r2')
    expect(isDeleteDisabled()).toBe(false)
  })

  it('переход на другую строку подменой не считается', () => {
    render(<ComplexEditableTable node={defect2Node} />)

    fireEvent.click(screen.getByText('B'))
    expect(state['Defect2Table.__selectedRowId']).toBe('r2')

    fireEvent.click(screen.getByText('A'))

    expect(state['Defect2Table.__selectedRowId']).toBe('r1')
    expect(isDeleteDisabled()).toBe(false)
  })
})
