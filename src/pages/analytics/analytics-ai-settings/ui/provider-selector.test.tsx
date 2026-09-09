import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

// Реальный i18n-инстанс: проверяются в том числе подписи карточек, а с
// заглушкой перевода тест подтверждал бы только наличие ключей.
import '@/app/config/i18n'

import { ProviderSelector } from './provider-selector'

describe('ProviderSelector', () => {
  afterEach(cleanup)

  it('показывает все четыре провайдера, включая свою модель', () => {
    render(<ProviderSelector value="ANTHROPIC" onChange={vi.fn()} />)

    expect(screen.getAllByRole('button')).toHaveLength(4)
    expect(screen.getByText('Своя модель')).toBeTruthy()
  })

  it('у облачных провайдеров подпись — хост, у своей модели — что адрес задаёт пользователь', () => {
    render(<ProviderSelector value="ANTHROPIC" onChange={vi.fn()} />)

    // Хост — технический идентификатор и не переводится; у своей модели
    // хоста по умолчанию нет, поэтому там переводимая подпись.
    expect(screen.getByText('openrouter.ai')).toBeTruthy()
    expect(screen.getByText('адрес задаёте сами')).toBeTruthy()
  })

  it('отмечает выбранным ровно один вариант', () => {
    render(<ProviderSelector value="LOCAL" onChange={vi.fn()} />)

    const pressed = screen
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-pressed') === 'true')

    expect(pressed).toHaveLength(1)
    expect(pressed[0].textContent).toContain('Своя модель')
  })

  it('сообщает о выборе своей модели', () => {
    const onChange = vi.fn()
    render(<ProviderSelector value="ANTHROPIC" onChange={onChange} />)

    fireEvent.click(screen.getByText('Своя модель'))

    expect(onChange).toHaveBeenCalledWith('LOCAL')
  })
})
