import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@/app/config/i18n'
import { AssistantComparisonResult } from './assistant-comparison-result'

afterEach(cleanup)

describe('AssistantComparisonResult', () => {
  it('показывает полные счётчики и подгружает расхождения при прокрутке', () => {
    const { container } = render(
      <AssistantComparisonResult
        result={{
          totalMovements1C: 42,
          totalMovementsJava: 41,
          matchingMovements: 20,
          differencesFound: 21,
          differences: Array.from({ length: 21 }, (_, index) => ({
            type: 'AMOUNT_MISMATCH',
            dimensionKey: `Счёт ${String(index + 1)}`,
            date: '2026-09-11',
            amount1C: '100.25',
            amountJava: '90.20',
          })),
        }}
      />
    )
    expect(screen.getByText('Расхождений: 21')).toBeTruthy()
    expect(screen.getByText('Записей в 1С: 42')).toBeTruthy()
    expect(screen.queryByText('Счёт 21')).toBeNull()
    fireEvent.scroll(container.querySelector('.overflow-y-auto')!)
    expect(screen.getByText('Счёт 21')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Показать ещё' })).toBeNull()
    expect(container.querySelector('time')?.dateTime).toBe('2026-09-11')
  })
})
