import { useState } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import { NumberInput } from './number-input'

const applied = vi.fn()

const Host = ({ initial = null }: { initial?: number | null }) => {
  const [value, setValue] = useState<number | null>(initial)
  return (
    <>
      <NumberInput
        value={value === null ? '' : String(value)}
        decimal
        precision={2}
        calculator
        onCalculatorApply={applied}
        onChange={(e) => {
          const raw = e.target.value
          setValue(raw === '' ? null : parseFloat(raw))
        }}
      />
      <span data-testid="owner">{value === null ? 'null' : String(value)}</span>
    </>
  )
}

const openCalculator = () => {
  fireEvent.click(screen.getByLabelText('calculator.open'))
}

const expressionInput = () =>
  screen.getByLabelText<HTMLInputElement>('calculator.expression')

const typeExpression = (text: string) => {
  fireEvent.change(expressionInput(), { target: { value: text } })
}

const result = () => screen.getByTestId('calculator-result').textContent
const owner = () => screen.getByTestId('owner').textContent

describe('NumberInput — калькулятор в поле', () => {
  afterEach(() => {
    applied.mockClear()
    cleanup()
  })

  it('переносит результат выражения в поле округлённым до разрядности', () => {
    render(<Host />)
    openCalculator()
    typeExpression('1200*12+300,456')

    expect(result()).toBe('14 700,46')

    fireEvent.click(screen.getByText('calculator.apply'))

    expect(owner()).toBe('14700.46')
    expect(applied).toHaveBeenCalledWith(14700.46)
    expect(screen.queryByLabelText('calculator.expression')).toBeNull()
  })

  it('открывается с текущим значением поля — расчёт продолжает сумму', () => {
    render(<Host initial={34600} />)
    openCalculator()

    expect(expressionInput().value).toBe('34600')

    fireEvent.click(screen.getByText('+'))
    fireEvent.click(screen.getByText('5'))
    fireEvent.click(screen.getByText('00'))

    expect(result()).toBe('35 100,00')
  })

  it('начисляет НДС кнопкой и оставляет след в ленте', () => {
    render(<Host initial={10000} />)
    openCalculator()

    fireEvent.click(screen.getByText('calculator.vat.vatAdd'))

    expect(result()).toBe('11 200,00')
    expect(screen.getByText('calculator.tape')).toBeTruthy()
  })

  it('не даёт перенести незаконченное выражение', () => {
    render(<Host />)
    openCalculator()
    typeExpression('100+')

    expect(screen.getByText('calculator.errors.syntax')).toBeTruthy()
    expect(
      screen.getByText('calculator.apply').closest('button')
    ).toHaveProperty('disabled', true)
  })

  it('у readOnly-поля кнопки калькулятора нет', () => {
    render(<NumberInput value="100" calculator readOnly onChange={vi.fn()} />)

    expect(screen.queryByLabelText('calculator.open')).toBeNull()
  })
})
