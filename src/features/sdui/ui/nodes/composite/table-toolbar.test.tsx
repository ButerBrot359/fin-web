import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TableCommandDescriptor } from '../../../types/view'
import { TableToolbar } from './table-toolbar'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'ru' },
  }),
}))

const mockDispatch = vi.fn(() => Promise.resolve(true))
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => mockDispatch,
}))

const noop = () => undefined

const stubSearch = {
  query: '',
  setQuery: noop,
  matches: [],
  current: null,
  next: noop,
  clear: noop,
  inputRef: { current: null },
  focusInput: noop,
}

const baseProps = {
  onAdd: noop,
  onMoveUp: noop,
  onMoveDown: noop,
  onRemove: noop,
  canMoveUp: false,
  canMoveDown: false,
  canRemove: false,
  search: stubSearch,
}

const podbor: TableCommandDescriptor = {
  command: 'table.podbor:VychetyIPN',
  label: 'Подбор',
  labelKz: 'Іріктеу',
  enabled: true,
  disabledReason: null,
  behavior: {
    flushPendingTables: false,
    resetsDirty: false,
    closeAfter: false,
  },
  inMoreMenu: true,
}

const raschet: TableCommandDescriptor = {
  command: 'table.rasschitatOklad:Nachisleniya',
  label: 'Рассчитать оклад',
  enabled: false,
  disabledReason: 'Нет строк для расчёта',
  behavior: { flushPendingTables: true, resetsDirty: false, closeAfter: false },
}

describe('TableToolbar: доменные кнопки из tableCommands (SCRUM-302)', () => {
  beforeEach(() => {
    cleanup()
    mockDispatch.mockClear()
  })

  it('рендерит кнопки в порядке массива после встроенных', () => {
    render(<TableToolbar {...baseProps} commands={[podbor, raschet]} />)
    const labels = screen.getAllByRole('button').map((b) => b.textContent || '')
    const iPodbor = labels.indexOf('Подбор')
    const iRaschet = labels.indexOf('Рассчитать оклад')
    expect(iPodbor).toBeGreaterThan(-1)
    expect(iRaschet).toBeGreaterThan(iPodbor)
  })

  it('клик диспатчит COMMAND с behavior из дескриптора', () => {
    render(<TableToolbar {...baseProps} commands={[podbor]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Подбор' }))
    expect(mockDispatch).toHaveBeenCalledWith(
      { type: 'COMMAND', command: 'table.podbor:VychetyIPN' },
      { flushPendingTables: false, resetsDirty: false, closeAfter: false }
    )
  })

  it('enabled:false — кнопка disabled, tooltip = disabledReason', async () => {
    render(<TableToolbar {...baseProps} commands={[raschet]} />)
    const btn = screen.getByRole('button', { name: 'Рассчитать оклад' })
    expect(btn).toHaveProperty('disabled', true)
    fireEvent.click(btn)
    expect(mockDispatch).not.toHaveBeenCalled()
    fireEvent.mouseOver(btn.parentElement!)
    expect(await screen.findByRole('tooltip')).toBeTruthy()
  })

  it('без commands рендерится как раньше', () => {
    render(<TableToolbar {...baseProps} />)
    expect(screen.getByRole('button', { name: 'table.add' })).toBeTruthy()
  })

  it('«Удалить» в ряду отсутствует, «Ещё» присутствует всегда', () => {
    render(<TableToolbar {...baseProps} />)
    // иконочной кнопки удаления больше нет: между «Добавить» и «Ещё» только ↑/↓
    expect(screen.getByRole('button', { name: 'table.more' })).toBeTruthy()
    expect(screen.queryByTestId('DeleteOutlineIcon')).toBeNull()
  })

  it('пункт удаления в «Ещё» зовёт onRemove', () => {
    const onRemove = vi.fn()
    render(<TableToolbar {...baseProps} onRemove={onRemove} canRemove={true} />)
    fireEvent.click(screen.getByRole('button', { name: 'table.more' }))
    fireEvent.click(screen.getByText('table.deleteRow'))
    expect(onRemove).toHaveBeenCalled()
  })

  it('доменная кнопка с inMoreMenu продублирована в «Ещё» и зовёт тот же dispatch', () => {
    render(<TableToolbar {...baseProps} commands={[podbor]} />)
    fireEvent.click(screen.getByRole('button', { name: 'table.more' }))
    const items = screen.getAllByText('Подбор')
    // одна в ряду, одна в меню
    expect(items.length).toBe(2)
    fireEvent.click(items[1])
    expect(mockDispatch).toHaveBeenCalledWith(
      { type: 'COMMAND', command: 'table.podbor:VychetyIPN' },
      { flushPendingTables: false, resetsDirty: false, closeAfter: false }
    )
  })

  it('Escape в поиске при непустом query чистит и не даёт форме (напр. MUI Dialog) закрыться', () => {
    const clear = vi.fn()
    const outerKeyDown = vi.fn()
    const search = { ...stubSearch, query: 'test', clear }
    render(
      <div onKeyDown={outerKeyDown}>
        <TableToolbar {...baseProps} search={search} />
      </div>
    )
    fireEvent.keyDown(screen.getByPlaceholderText('table.searchPlaceholder'), {
      key: 'Escape',
    })
    expect(clear).toHaveBeenCalled()
    expect(outerKeyDown).not.toHaveBeenCalled()
  })

  it('Escape в поиске при пустом query не перехватывается — всплывает наружу', () => {
    const clear = vi.fn()
    const outerKeyDown = vi.fn()
    const search = { ...stubSearch, query: '', clear }
    render(
      <div onKeyDown={outerKeyDown}>
        <TableToolbar {...baseProps} search={search} />
      </div>
    )
    fireEvent.keyDown(screen.getByPlaceholderText('table.searchPlaceholder'), {
      key: 'Escape',
    })
    expect(clear).not.toHaveBeenCalled()
    expect(outerKeyDown).toHaveBeenCalled()
  })

  it('клик по команде при выбранной строке → value: {rowId}', () => {
    render(
      <TableToolbar
        {...baseProps}
        commands={[podbor]}
        selectedRowId="27855679-3"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Подбор' }))
    expect(mockDispatch).toHaveBeenCalledWith(
      {
        type: 'COMMAND',
        command: 'table.podbor:VychetyIPN',
        value: { rowId: '27855679-3' },
      },
      { flushPendingTables: false, resetsDirty: false, closeAfter: false }
    )
  })

  it('без выбранной строки → ключа value нет', () => {
    render(<TableToolbar {...baseProps} commands={[podbor]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Подбор' }))
    expect(mockDispatch).toHaveBeenCalledWith(
      { type: 'COMMAND', command: 'table.podbor:VychetyIPN' },
      { flushPendingTables: false, resetsDirty: false, closeAfter: false }
    )
  })
})
