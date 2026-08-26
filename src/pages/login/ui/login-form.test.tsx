import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import '@/app/config/i18n'

import type * as AuthModule from '@/features/auth'

import { LoginForm } from './login-form'

const signIn = vi.fn()

vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<typeof AuthModule>('@/features/auth')
  return {
    ...actual,
    useAuthStore: (selector: (state: { signIn: unknown }) => unknown) =>
      selector({ signIn }),
  }
})

const renderForm = () =>
  render(
    <MemoryRouter>
      <LoginForm />
    </MemoryRouter>
  )

const fields = () => {
  const inputs = document.querySelectorAll('form input')
  return { login: inputs[0], password: inputs[1] }
}

const type = (input: Element, value: string) => {
  fireEvent.change(input, { target: { value } })
}

/**
 * Форма входа.
 *
 * Проверяется то, что видно на трёх состояниях макета: пустая форма с погашенной кнопкой,
 * заполненная с активной, и отказ с текстом под полем пароля. Плюс главное свойство
 * webbuh — <b>логин уходит на сервер без правок</b>: в 1С это «Фамилия Имя», и любой
 * клиентский `trim` или приведение регистра разошлись бы с серверной нормализацией.
 */
describe('LoginForm', () => {
  afterEach(() => {
    cleanup()
    signIn.mockReset()
    window.localStorage.clear()
  })

  it('гасит кнопку, пока не заполнены оба поля', () => {
    renderForm()
    // Матчеров jest-dom в проекте нет — проверяем свойство напрямую.
    const submit = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Войти',
    })
    expect(submit.disabled).toBe(true)

    type(fields().login, 'tdorozhkina')
    expect(submit.disabled).toBe(true)

    type(fields().password, '123435')
    expect(submit.disabled).toBe(false)
  })

  it('отправляет логин ровно так, как его набрали', async () => {
    signIn.mockResolvedValue({})
    renderForm()

    type(fields().login, '  ИВАНОВ   Иван ')
    type(fields().password, 'secret')
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('  ИВАНОВ   Иван ', 'secret')
    })
  })

  it('показывает текст отказа с сервера и стирает пароль', async () => {
    signIn.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { message: 'Неверный логин или пароль' } },
    })
    renderForm()

    type(fields().login, 'tdorozhkina')
    type(fields().password, '123435')
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))

    expect(await screen.findByText('Неверный логин или пароль')).toBeTruthy()
    expect((fields().password as HTMLInputElement).value).toBe('')
    // Логин остаётся: повторяют обычно только пароль.
    expect((fields().login as HTMLInputElement).value).toBe('tdorozhkina')
  })

  it('переключает показ пароля', () => {
    renderForm()
    expect((fields().password as HTMLInputElement).type).toBe('password')

    fireEvent.click(screen.getByLabelText('Показать пароль'))
    expect((fields().password as HTMLInputElement).type).toBe('text')

    fireEvent.click(screen.getByLabelText('Скрыть пароль'))
    expect((fields().password as HTMLInputElement).type).toBe('password')
  })
})
