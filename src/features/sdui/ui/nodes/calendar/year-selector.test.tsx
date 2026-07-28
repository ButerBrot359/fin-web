import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { YearSelector } from './year-selector'

afterEach(cleanup)

describe('YearSelector', () => {
  it('стрелка «назад» шлёт god-1', () => {
    const onChange = vi.fn()
    render(<YearSelector god={2025} godMin={2021} godMax={2027} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('prev-year'))
    expect(onChange).toHaveBeenCalledWith(2024)
  })

  it('на нижней границе «назад» disabled', () => {
    render(<YearSelector god={2021} godMin={2021} godMax={2027} onChange={vi.fn()} />)
    expect((screen.getByLabelText('prev-year') as HTMLButtonElement).disabled).toBe(true)
  })

  it('godMax=null: «вперёд» активна', () => {
    render(<YearSelector god={2027} godMin={2021} godMax={null} onChange={vi.fn()} />)
    expect((screen.getByLabelText('next-year') as HTMLButtonElement).disabled).toBe(false)
  })
})
