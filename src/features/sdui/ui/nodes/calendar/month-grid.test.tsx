import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { MonthGrid } from './month-grid'

afterEach(cleanup)

const base = {
  year: 2025,
  month: 0,
  monthLabel: 'январь',
  weekdayLabels: ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'],
  dayAriaLabel: (_y: number, _m: number, d: number) => `день ${String(d)}`,
}

describe('MonthGrid', () => {
  it('рендерит заголовок месяца и 7 подписей дней недели', () => {
    render(<MonthGrid {...base} daysByDate={new Map()} />)
    expect(screen.getByText('январь')).toBeTruthy()
    for (const w of base.weekdayLabels) expect(screen.getByText(w)).toBeTruthy()
  })

  it('рендерит все дни месяца (1..31 для января)', () => {
    render(<MonthGrid {...base} daysByDate={new Map()} />)
    expect(screen.getByRole('button', { name: 'день 1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'день 31' })).toBeTruthy()
  })
})
