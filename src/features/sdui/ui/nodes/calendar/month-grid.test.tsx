import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CalendarDay } from '../../../lib/calendar/calendar-types'
import { MonthGrid } from './month-grid'

afterEach(cleanup)

const base = {
  year: 2025,
  month: 0,
  monthLabel: 'январь',
  weekdayLabels: ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'],
  editable: true,
  dayAriaLabel: (_y: number, _m: number, d: number) => `день ${d}`,
}

describe('MonthGrid', () => {
  it('рендерит заголовок месяца и 7 подписей дней недели', () => {
    render(
      <MonthGrid {...base} daysByDate={new Map()} onToggle={vi.fn()} />,
    )
    expect(screen.getByText('январь')).toBeTruthy()
    for (const w of base.weekdayLabels) expect(screen.getByText(w)).toBeTruthy()
  })

  it('рендерит все дни месяца (1..31 для января)', () => {
    render(<MonthGrid {...base} daysByDate={new Map()} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'день 1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'день 31' })).toBeTruthy()
  })

  it('клик по дню шлёт onToggle с ISO-датой (0-паддинг)', () => {
    const onToggle = vi.fn()
    const days = new Map<string, CalendarDay>([
      ['2025-01-05', { data: '2025-01-05', vklyuchen: true, ruchnoy: false }],
    ])
    render(<MonthGrid {...base} daysByDate={days} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button', { name: 'день 5' }))
    expect(onToggle).toHaveBeenCalledWith('2025-01-05')
  })
})
