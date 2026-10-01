import type { ReactElement } from 'react'
import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TableCommandDescriptor, ViewNode } from '../../../types/view'
import { TableNode } from './table-node'

// Read-only таблица с props.tableCommands (экран конструктора отчётности,
// push-модель: строки лежат в state по binding и несут `id`, не `rowId`).

const render = (ui: ReactElement) =>
  rtlRender(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
  )

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ru' } }),
  initReactI18next: { type: 'backend', init: () => undefined },
}))

const state: Record<string, unknown> = {}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    getValue: (b?: string) => (b ? state[b] : undefined),
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))

const mockDispatch = vi.fn(() => Promise.resolve(true))
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => mockDispatch,
}))

const behavior = {
  flushPendingTables: true,
  resetsDirty: false,
  closeAfter: false,
}

// Дескриптор ровно в форме ответа highload (OPEN /otchetnost).
const otkryt: TableCommandDescriptor = {
  command: 'otchetnost.konstruktor.formy.otkryt',
  label: 'Открыть',
  enabled: true,
  behavior,
  inMoreMenu: false,
  requiresSelectedRow: true,
}

const formyTable = (tableCommands?: TableCommandDescriptor[]): ViewNode => ({
  id: 'otchetnost.formy.table',
  type: 'TABLE',
  binding: 'otchetnost.formy.table',
  props: {
    title: 'Формы',
    editable: false,
    ...(tableCommands ? { tableCommands } : {}),
  },
  children: [
    {
      id: 'otchetnost.formy.table.nameRu',
      type: 'TABLE_COLUMN',
      binding: 'nameRu',
      props: { label: 'Наименование', readonly: true },
    },
    {
      id: 'otchetnost.formy.table.kod',
      type: 'TABLE_COLUMN',
      binding: 'kod',
      props: { label: 'Код', readonly: true },
    },
  ],
})

const rowOf = (text: string): HTMLElement => {
  const row = screen.getByText(text).closest('tr')
  if (!row) throw new Error(`row ${text} not rendered`)
  return row
}

const keyboardContainer = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>(
    '[data-sdui-table-keyboard="true"]'
  )
  if (!el) throw new Error('keyboard container not rendered')
  return el
}

beforeEach(() => {
  mockDispatch.mockClear()
  state['otchetnost.formy.table'] = [
    { id: '17', formaId: 17, kod: 'F1', nameRu: 'Баланс' },
    { id: '18', formaId: 18, kod: 'F2', nameRu: 'Отчёт о результатах' },
  ]
})

describe('ReadOnlyTable + props.tableCommands', () => {
  it('рисует панель команд над таблицей', () => {
    render(<TableNode node={formyTable([otkryt])} />)
    expect(screen.getByRole('button', { name: 'Открыть' })).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('table.searchPlaceholder')
    ).toBeInTheDocument()
    // Строковых операций над данными у read-only таблицы нет
    expect(screen.queryByRole('button', { name: 'table.add' })).toBeNull()
  })

  it('команда с requiresSelectedRow недоступна без выбранной строки', () => {
    render(<TableNode node={formyTable([otkryt])} />)
    expect(screen.getByRole('button', { name: 'Открыть' })).toBeDisabled()
  })

  it('клик выбирает строку; команда уходит с value {rowId} и behavior', () => {
    render(<TableNode node={formyTable([otkryt])} />)
    fireEvent.click(rowOf('Баланс'))
    expect(rowOf('Баланс')).toHaveAttribute('aria-selected', 'true')
    expect(rowOf('Отчёт о результатах')).toHaveAttribute(
      'aria-selected',
      'false'
    )

    const button = screen.getByRole('button', { name: 'Открыть' })
    expect(button).toBeEnabled()
    fireEvent.click(button)
    expect(mockDispatch).toHaveBeenCalledWith(
      {
        type: 'COMMAND',
        command: 'otchetnost.konstruktor.formy.otkryt',
        value: { rowId: '17' },
      },
      behavior
    )
  })

  it('двойной клик запускает единственную строковую команду', () => {
    render(<TableNode node={formyTable([otkryt])} />)
    fireEvent.doubleClick(rowOf('Отчёт о результатах'))
    expect(mockDispatch).toHaveBeenCalledTimes(1)
    expect(mockDispatch).toHaveBeenCalledWith(
      {
        type: 'COMMAND',
        command: 'otchetnost.konstruktor.formy.otkryt',
        value: { rowId: '18' },
      },
      behavior
    )
  })

  it('↓ выбирает строку, Enter запускает команду строки', () => {
    render(<TableNode node={formyTable([otkryt])} />)
    const container = keyboardContainer()
    fireEvent.keyDown(container, { key: 'ArrowDown' })
    expect(rowOf('Баланс')).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(container, { key: 'ArrowDown' })
    expect(rowOf('Отчёт о результатах')).toHaveAttribute(
      'aria-selected',
      'true'
    )
    fireEvent.keyDown(container, { key: 'Enter' })
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ value: { rowId: '18' } }),
      behavior
    )
  })

  it('несколько строковых команд — двойной клик ничего не угадывает', () => {
    const izmenit = {
      ...otkryt,
      command: 'otchetnost.x.izmenit',
      label: 'Изменить',
    }
    const udalit = {
      ...otkryt,
      command: 'otchetnost.x.udalit',
      label: 'Удалить',
    }
    render(<TableNode node={formyTable([izmenit, udalit])} />)
    fireEvent.doubleClick(rowOf('Баланс'))
    expect(mockDispatch).not.toHaveBeenCalled()
    // …но строку выбирает, и кнопки становятся доступны
    fireEvent.click(rowOf('Баланс'))
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeEnabled()
  })

  it('недоступная (enabled=false) команда не запускается двойным кликом', () => {
    render(<TableNode node={formyTable([{ ...otkryt, enabled: false }])} />)
    fireEvent.doubleClick(rowOf('Баланс'))
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('без tableCommands — прежняя пассивная таблица: ни панели, ни выбора', () => {
    render(<TableNode node={formyTable()} />)
    expect(screen.queryByPlaceholderText('table.searchPlaceholder')).toBeNull()
    expect(
      document.querySelector('[data-sdui-table-keyboard="true"]')
    ).toBeNull()
    fireEvent.click(rowOf('Баланс'))
    fireEvent.doubleClick(rowOf('Баланс'))
    expect(rowOf('Баланс')).not.toHaveAttribute('aria-selected')
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
