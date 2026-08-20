import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { NodeProps, ViewNode, ViewNodeAction } from '../../../types/view'

const { dispatch } = vi.hoisted(() => ({
  dispatch: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => dispatch }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('./calendar-legend', () => ({ CalendarLegend: () => null }))
// Production-receiver стаб: маркер + ключ ремоунта (draftId:draftVersion:year)
vi.mock('./production/production-calendar-node', () => ({
  ProductionCalendarNode: ({ node }: NodeProps) => (
    <div data-testid="production-calendar">{node.id}</div>
  ),
}))
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
// MonthGrid-стаб: маркер месяца + реальная ячейка через renderDay (15-е число
// января) — так узел тестируется с настоящей CalendarDayCell.
vi.mock('./month-grid', () => ({
  MonthGrid: ({
    month,
    year,
    renderDay,
  }: {
    month: number
    year: number
    renderDay: (iso: string, dayNumber: number) => ReactNode
  }) => (
    <div>
      <span>m{month}</span>
      {month === 0 ? renderDay(`${String(year)}-01-15`, 15) : null}
    </div>
  ),
}))

import { CalendarNode } from './calendar-node'

const action = (trigger: string, command: string): ViewNodeAction => ({
  trigger,
  actionId: `act-${trigger}`,
  command,
})

const node = (
  props: Record<string, unknown>,
  actions?: ViewNodeAction[]
): ViewNode =>
  ({ id: 'proizvKalendar', type: 'CALENDAR', props, actions }) as ViewNode

const inclusionProps = {
  mode: 'inclusion',
  year: 2025,
  minYear: 2021,
  maxYear: 2027,
  days: [{ date: '2025-01-15', active: true, manual: false }],
}

const dayCell = () => screen.getByRole('button', { name: '15 января 2025' })

describe('CalendarNode', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('inclusion: рендерит 12 месяцев и день из days', () => {
    render(
      <CalendarNode
        node={node(inclusionProps, [action('changeYear', 'cal.changeYear:X')])}
      />
    )
    expect(screen.getAllByText(/^m\d+$/)).toHaveLength(12)
    expect(dayCell().getAttribute('data-working')).toBe('true')
    expect(screen.queryByTestId('production-calendar')).toBeNull()
  })

  it('inclusion: смена года диспатчит команду changeYear-действия со значением-годом', () => {
    render(
      <CalendarNode
        node={node(inclusionProps, [action('changeYear', 'cal.changeYear:X')])}
      />
    )
    fireEvent.click(screen.getByText('year'))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'cal.changeYear:X',
      value: 2026,
      sourceNodeId: 'proizvKalendar',
    })
  })

  it('без changeYear-действия смена года ничего не диспатчит', () => {
    render(<CalendarNode node={node(inclusionProps)} />)
    fireEvent.click(screen.getByText('year'))
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('mode отсутствует → inclusion-режим по умолчанию', () => {
    render(<CalendarNode node={node({ year: 2025, days: [] })} />)
    expect(screen.getAllByText(/^m\d+$/)).toHaveLength(12)
    expect(screen.queryByTestId('production-calendar')).toBeNull()
  })

  it('dayKind → production-receiver (SCRUM-277 contract v2)', () => {
    render(
      <CalendarNode
        node={node({
          mode: 'dayKind',
          year: 2030,
          draftId: 'd',
          draftVersion: 4,
        })}
      />
    )
    expect(screen.getByTestId('production-calendar')).toBeTruthy()
    expect(screen.queryByText(/^m\d+$/)).toBeNull()
  })

  it('inclusion: year отсутствует → ничего не рендерит', () => {
    const { container } = render(<CalendarNode node={node({})} />)
    expect(container.firstChild).toBeNull()
  })
})
