import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode, ViewNodeAction } from '../../../types/view'

const { dispatch } = vi.hoisted(() => ({
  dispatch: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => dispatch }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('./calendar-legend', () => ({ CalendarLegend: () => null }))
vi.mock('./day-kind-legend', () => ({ DayKindLegend: () => null }))
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
// января) — так узел тестируется с настоящими CalendarDayCell/DayKindCell.
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

const dayKindProps = {
  mode: 'dayKind',
  year: 2025,
  yearFilled: true,
  dayKinds: [
    { code: 'WORK', title: 'Рабочий' },
    { code: 'HOLIDAY', title: 'Праздник' },
  ],
  days: [{ date: '2025-01-15', kind: 'HOLIDAY', kindTitle: 'Праздник' }],
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

  it('dayKind: ячейка красится по kind, выбор вида из меню диспатчит {date, kind}', () => {
    render(
      <CalendarNode
        node={node(dayKindProps, [action('setDayKind', 'cal.setDayKind:X')])}
      />
    )
    expect(dayCell().getAttribute('data-kind')).toBe('HOLIDAY')
    fireEvent.click(dayCell())
    fireEvent.click(screen.getByText('Рабочий'))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'cal.setDayKind:X',
      value: { date: '2025-01-15', kind: 'WORK' },
      sourceNodeId: 'proizvKalendar',
    })
  })

  it('dayKind без setDayKind-действия: ячейки disabled, меню не открывается', () => {
    render(<CalendarNode node={node(dayKindProps)} />)
    const cell = dayCell()
    expect(cell.hasAttribute('disabled')).toBe(true)
    fireEvent.click(cell)
    expect(screen.queryByText('Рабочий')).toBeNull()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('кнопка fillDefaults видна только при fillDefaults-действии и диспатчит год', () => {
    const { unmount } = render(<CalendarNode node={node(dayKindProps)} />)
    expect(screen.queryByText('sdui.calendar.fillDefaults')).toBeNull()
    unmount()

    render(
      <CalendarNode
        node={node(dayKindProps, [
          action('fillDefaults', 'cal.fillDefaults:X'),
        ])}
      />
    )
    fireEvent.click(screen.getByText('sdui.calendar.fillDefaults'))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'cal.fillDefaults:X',
      value: 2025,
      sourceNodeId: 'proizvKalendar',
    })
  })

  it('year отсутствует → ничего не рендерит', () => {
    const { container } = render(<CalendarNode node={node({})} />)
    expect(container.firstChild).toBeNull()
  })
})
