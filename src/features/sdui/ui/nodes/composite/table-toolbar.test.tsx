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

const baseProps = {
  onAdd: noop,
  onMoveUp: noop,
  onMoveDown: noop,
  onRemove: noop,
  canMoveUp: false,
  canMoveDown: false,
  canRemove: false,
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
})
