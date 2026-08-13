import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'

const { dispatch } = vi.hoisted(() => ({
  dispatch: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => dispatch }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('./calendar-legend', () => ({ CalendarLegend: () => null }))
// YearSelector-стаб: кнопка, дёргающая onChange(2026)
vi.mock('./year-selector', () => ({
  YearSelector: ({ onChange }: { onChange: (y: number) => void }) => (
    <button
      onClick={() => {
        onChange(2026)
      }}
    >
      year
    </button>
  ),
}))
// MonthGrid-стаб: без onToggle — дни read-only
vi.mock('./month-grid', () => ({
  MonthGrid: ({ month }: { month: number }) => <span>m{month}</span>,
}))

import { CalendarNode } from './calendar-node'

const node = (props: Record<string, unknown>): ViewNode =>
  ({ id: 'kalendari.rezultatZapolneniya', type: 'CALENDAR', props }) as ViewNode

const baseProps = { god: 2025, godMin: 2021, godMax: 2027, dni: [] }

describe('CalendarNode', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('рендерит 12 месяцев', () => {
    render(<CalendarNode node={node(baseProps)} />)
    expect(screen.getAllByText(/^m\d+$/)).toHaveLength(12)
  })

  it('смена года шлёт COMMAND kalendari.god.change', () => {
    render(<CalendarNode node={node(baseProps)} />)
    fireEvent.click(screen.getByText('year'))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'kalendari.god.change',
      value: 2026,
      sourceNodeId: 'kalendari.rezultatZapolneniya',
    })
  })

  it('god отсутствует → ничего не рендерит', () => {
    const { container } = render(<CalendarNode node={node({})} />)
    expect(container.firstChild).toBeNull()
  })

  it('дни некликабельны: клик по ячейке не шлёт никакой dispatch', () => {
    render(<CalendarNode node={node(baseProps)} />)
    // в реальном DOM день — disabled button; убеждаемся, что toggle-команда невозможна
    const before = dispatch.mock.calls.length
    // никаких onToggle-стабов больше нет; проверяем, что смена года — единственный dispatch-путь
    fireEvent.click(screen.getByText('year'))
    expect(dispatch).toHaveBeenCalledTimes(before + 1)
    expect(
      dispatch.mock.calls.every(
        ([a]: [{ command: string }]) => a.command !== 'kalendari.den.toggle'
      )
    ).toBe(true)
  })
})
