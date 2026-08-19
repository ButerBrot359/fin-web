import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { YearSelector } from './year-selector'

afterEach(cleanup)

describe('YearSelector', () => {
  it('стрелка «назад» шлёт year-1', () => {
    const onChange = vi.fn()
    render(
      <YearSelector
        year={2025}
        minYear={2021}
        maxYear={2027}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByLabelText('prev-year'))
    expect(onChange).toHaveBeenCalledWith(2024)
  })

  it('на нижней границе «назад» disabled', () => {
    render(
      <YearSelector
        year={2021}
        minYear={2021}
        maxYear={2027}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByLabelText('prev-year').hasAttribute('disabled')).toBe(
      true
    )
  })

  it('maxYear=null: «вперёд» активна', () => {
    render(
      <YearSelector
        year={2027}
        minYear={2021}
        maxYear={null}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByLabelText('next-year').hasAttribute('disabled')).toBe(
      false
    )
  })
})
