import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { CalendarDayCell } from './calendar-day-cell'

afterEach(cleanup)

const day = (over: Partial<{ vklyuchen: boolean; ruchnoy: boolean }> = {}) => ({
  data: '2025-03-15',
  vklyuchen: over.vklyuchen ?? false,
  ruchnoy: over.ruchnoy ?? false,
})

describe('CalendarDayCell', () => {
  it('рабочий день помечен data-working=true', () => {
    render(
      <CalendarDayCell
        dayNumber={15}
        day={day({ vklyuchen: true })}
        ariaLabel="15 марта 2025"
      />
    )
    const btn = screen.getByRole('button', { name: '15 марта 2025' })
    expect(btn.getAttribute('data-working')).toBe('true')
  })

  it('ручной день помечен data-manual=true', () => {
    render(
      <CalendarDayCell
        dayNumber={15}
        day={day({ ruchnoy: true })}
        ariaLabel="d"
      />
    )
    expect(screen.getByRole('button').getAttribute('data-manual')).toBe('true')
  })

  it('день всегда disabled (read-only)', () => {
    render(
      <CalendarDayCell
        dayNumber={5}
        day={{ data: '2025-01-05', vklyuchen: true, ruchnoy: false }}
        ariaLabel="5"
      />
    )
    const btn = screen.getByRole('button', { name: '5' })
    expect(btn.disabled).toBe(true)
  })
})
