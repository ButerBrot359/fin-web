import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { MonthGrid } from './month-grid'

afterEach(cleanup)

const base = {
  year: 2025,
  month: 0,
  monthLabel: 'январь',
  weekdayLabels: ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'],
  // SCRUM-362 B-2: сетка получает render-prop дня вместо daysByDate
  renderDay: (iso: string, dayNumber: number) => (
    <button
      type="button"
      aria-label={`день ${String(dayNumber)}`}
      data-iso={iso}
    >
      {dayNumber}
    </button>
  ),
}

describe('MonthGrid', () => {
  it('рендерит заголовок месяца и 7 подписей дней недели', () => {
    render(<MonthGrid {...base} />)
    expect(screen.getByText('январь')).toBeTruthy()
    for (const w of base.weekdayLabels) expect(screen.getByText(w)).toBeTruthy()
  })

  it('рендерит все дни месяца через renderDay (1..31 для января)', () => {
    render(<MonthGrid {...base} />)
    expect(screen.getByRole('button', { name: 'день 1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'день 31' })).toBeTruthy()
  })

  it('передаёт в renderDay ISO-дату дня', () => {
    render(<MonthGrid {...base} />)
    const first = screen.getByRole('button', { name: 'день 1' })
    expect(first.getAttribute('data-iso')).toBe('2025-01-01')
  })
})
