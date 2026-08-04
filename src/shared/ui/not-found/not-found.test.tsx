import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { NotFound } from './not-found'

describe('NotFound', () => {
  it('показывает заголовок по i18n-ключу', () => {
    render(<NotFound />)
    // i18n в тестах обычно возвращает ключ — проверяем наличие узла
    expect(
      screen.getByText(/sdui\.notFound\.title|Страница не найдена/)
    ).toBeTruthy()
  })
})
