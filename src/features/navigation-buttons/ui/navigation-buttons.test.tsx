import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NavigationButtons } from './navigation-buttons'

vi.mock('@/shared/assets/navigation/arrow-left-default.svg', () => ({
  default: () => null,
}))
vi.mock('@/shared/assets/navigation/arrow-right-default.svg', () => ({
  default: () => null,
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

// Без I18nextProvider useTranslation возвращает сам ключ — ищем по нему.
describe('NavigationButtons', () => {
  afterEach(cleanup)

  it('с onBack зовёт его по клику «назад»', () => {
    const onBack = vi.fn()
    render(
      <MemoryRouter>
        <NavigationButtons onBack={onBack} />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'actions.back' }))

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('кнопка «вперёд» disabled', () => {
    render(
      <MemoryRouter>
        <NavigationButtons />
      </MemoryRouter>,
    )

    const forward = screen.getByRole('button', {
      name: 'actions.forward',
    }) as HTMLButtonElement
    expect(forward.disabled).toBe(true)
  })
})
