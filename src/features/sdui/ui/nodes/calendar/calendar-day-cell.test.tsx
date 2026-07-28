import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
        editable
        onToggle={vi.fn()}
        ariaLabel="15 марта 2025"
      />,
    )
    const btn = screen.getByRole('button', { name: '15 марта 2025' })
    expect(btn.getAttribute('data-working')).toBe('true')
  })

  it('ручной день помечен data-manual=true', () => {
    render(
      <CalendarDayCell
        dayNumber={15}
        day={day({ ruchnoy: true })}
        editable
        onToggle={vi.fn()}
        ariaLabel="d"
      />,
    )
    expect(screen.getByRole('button').getAttribute('data-manual')).toBe('true')
  })

  it('editable=true: клик шлёт onToggle с датой', () => {
    const onToggle = vi.fn()
    render(
      <CalendarDayCell dayNumber={15} day={day()} editable onToggle={onToggle} ariaLabel="d" />,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledWith('2025-03-15')
  })

  it('editable=false: кнопка disabled, клик молчит', () => {
    const onToggle = vi.fn()
    render(
      <CalendarDayCell dayNumber={15} day={day()} editable={false} onToggle={onToggle} ariaLabel="d" />,
    )
    const btn = screen.getByRole('button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(onToggle).not.toHaveBeenCalled()
  })
})
