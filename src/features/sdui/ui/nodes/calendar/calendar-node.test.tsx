import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'

const { dispatch, showToast } = vi.hoisted(() => ({
  dispatch: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => dispatch }))
vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('./calendar-legend', () => ({ CalendarLegend: () => null }))
// YearSelector-стаб: кнопка, дёргающая onChange(2026)
vi.mock('./year-selector', () => ({
  YearSelector: ({ onChange }: { onChange: (y: number) => void }) => (
    <button onClick={() => onChange(2026)}>year</button>
  ),
}))
// MonthGrid-стаб: одна кнопка на месяц, дёргает onToggle фикс-датой
vi.mock('./month-grid', () => ({
  MonthGrid: ({ month, onToggle }: { month: number; onToggle: (d: string) => void }) => (
    <button onClick={() => onToggle(`2025-0${month + 1}-01`)}>m{month}</button>
  ),
}))

import { CalendarNode } from './calendar-node'

const node = (props: Record<string, unknown>): ViewNode =>
  ({ id: 'kalendari.rezultatZapolneniya', type: 'CALENDAR', props }) as ViewNode

const baseProps = { god: 2025, godMin: 2021, godMax: 2027, redaktiruemyy: true, dni: [] }

describe('CalendarNode', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('рендерит 12 месяцев', () => {
    render(<CalendarNode node={node(baseProps)} />)
    expect(screen.getAllByText(/^m\d+$/)).toHaveLength(12)
  })

  it('клик по дню шлёт COMMAND kalendari.den.toggle с датой', () => {
    render(<CalendarNode node={node(baseProps)} />)
    fireEvent.click(screen.getByText('m0'))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'kalendari.den.toggle',
      value: '2025-01-01',
      sourceNodeId: 'kalendari.rezultatZapolneniya',
    })
  })

  it('первый тоггл показывает toast один раз, второй — нет', () => {
    render(<CalendarNode node={node(baseProps)} />)
    fireEvent.click(screen.getByText('m0'))
    fireEvent.click(screen.getByText('m1'))
    expect(showToast).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith('info', 'sdui.calendar.applyImmediately')
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
})
