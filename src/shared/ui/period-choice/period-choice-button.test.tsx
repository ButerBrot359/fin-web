import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: { returnObjects?: boolean }) =>
      o?.returnObjects
        ? Array.from({ length: 12 }, (_, i) => `M${String(i)}`)
        : k,
  }),
}))
vi.mock('@/shared/assets/icons/cross.svg', () => ({ default: () => null }))
vi.mock('@/shared/ui/inputs', () => ({
  DateTimeInput: (props: { label?: string; value?: string }) => (
    <input aria-label={props.label} value={props.value ?? ''} readOnly />
  ),
}))

import { PeriodChoiceButton } from './period-choice-button'

describe('PeriodChoiceButton', () => {
  it('открывает окно с текущим периодом и возвращает выбранный', () => {
    const onChange = vi.fn()
    render(
      <PeriodChoiceButton
        period={{ from: '2026-08-31T19:00:00.000Z', to: '' }}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByLabelText('periodChoice.title'))
    expect(screen.getByLabelText('periodChoice.from')).not.toHaveValue('')

    fireEvent.click(screen.getAllByText('M8')[1])
    fireEvent.click(screen.getByText('periodChoice.select'))

    expect(onChange).toHaveBeenCalledWith({
      from: '2026-09-01',
      to: '2026-09-30',
    })
  })

  it('заблокированная кнопка окно не открывает', () => {
    render(
      <PeriodChoiceButton
        period={{ from: '', to: '' }}
        onChange={vi.fn()}
        disabled
      />
    )
    fireEvent.click(screen.getByLabelText('periodChoice.title'))
    expect(screen.queryByText('periodChoice.select')).toBeNull()
  })

  it('в квартальном режиме нет месяцев, дата и стандартный период дают квартал', () => {
    const onChange = vi.fn()
    render(
      <PeriodChoiceButton
        period={{ from: '2026-04-01', to: '2026-06-30' }}
        quarterOnly
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByLabelText('periodChoice.title'))

    expect(screen.queryByText('M0')).toBeNull()
    expect(screen.getAllByText('periodChoice.quarter')).toHaveLength(12)

    fireEvent.click(screen.getByText('periodChoice.showStandard'))
    expect(screen.queryByText('periodChoice.standard.thisMonth')).toBeNull()
    expect(
      screen.getByText('periodChoice.standard.thisQuarter')
    ).toBeInTheDocument()
    expect(
      screen.getByText('periodChoice.standard.lastQuarter')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByText('periodChoice.select'))
    expect(onChange).toHaveBeenCalledWith({
      from: '2026-04-01',
      to: '2026-06-30',
    })
  })
})
