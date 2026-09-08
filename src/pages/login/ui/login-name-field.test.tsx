import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import '@/app/config/i18n'

import { LoginNameField } from './login-name-field'

const requestSelectionList = vi.fn()

vi.mock('@/shared/api/auth/auth-endpoints', () => ({
  requestSelectionList: () => requestSelectionList() as Promise<string[]>,
}))

const renderField = (onChange = vi.fn()) => {
  render(
    <LoginNameField
      value=""
      onChange={onChange}
      hasError={false}
      disabled={false}
      autoFocus={false}
    />
  )
  return onChange
}

const openMenu = () => {
  fireEvent.click(screen.getByLabelText('Выбрать пользователя'))
}

/**
 * Поле «Пользователь» — список выбора, как в диалоге запуска 1С.
 *
 * Проверяется главное свойство: в выпадашке стоит СЕРВЕРНЫЙ список выбора, а логины этого
 * устройства остаются запасным вариантом. Перепутать эти два источника — значит показать
 * бухгалтеру на общей машине не тех, кого показывает 1С.
 */
describe('LoginNameField', () => {
  afterEach(() => {
    cleanup()
    requestSelectionList.mockReset()
    window.localStorage.clear()
  })

  it('показывает список выбора с сервера', async () => {
    window.localStorage.setItem(
      'webbuh.auth.knownLogins',
      JSON.stringify(['Дорожкина Татьяна'])
    )
    requestSelectionList.mockResolvedValue(['Ахметова Айгуль', 'Иванов Иван'])

    renderField()
    openMenu()

    expect(await screen.findByText('Ахметова Айгуль')).toBeTruthy()
    expect(screen.getByText('Иванов Иван')).toBeTruthy()
    // Логин этого устройства НЕ подмешивается к серверному списку: 1С показывает ровно тех,
    // у кого стоит «Показывать в списке выбора».
    expect(screen.queryByText('Дорожкина Татьяна')).toBeNull()
  })

  it('подставляет выбранного пользователя в поле', async () => {
    requestSelectionList.mockResolvedValue(['Иванов Иван'])
    const onChange = renderField()
    openMenu()

    fireEvent.click(await screen.findByText('Иванов Иван'))
    expect(onChange).toHaveBeenCalledWith('Иванов Иван')
  })

  it('при недоступном сервере показывает логины этого устройства', async () => {
    window.localStorage.setItem(
      'webbuh.auth.knownLogins',
      JSON.stringify(['Дорожкина Татьяна'])
    )
    requestSelectionList.mockRejectedValue(new Error('нет сети'))

    renderField()
    openMenu()

    expect(await screen.findByText('Дорожкина Татьяна')).toBeTruthy()
  })

  it('пустой список — штатное состояние, а не ошибка', async () => {
    requestSelectionList.mockResolvedValue([])

    renderField()
    openMenu()
    expect(await screen.findByText('Список пользователей пуст')).toBeTruthy()
  })
})
