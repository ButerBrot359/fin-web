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

import { ChangePasswordForm } from './change-password-form'

const requestChangePassword = vi.fn()
const signOut = vi.fn()

vi.mock('@/shared/api/auth/auth-endpoints', () => ({
  requestChangePassword: (
    token: string,
    current: string,
    next: string
  ): Promise<void> =>
    requestChangePassword(token, current, next) as Promise<void>,
}))

vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<typeof AuthModule>('@/features/auth')
  return {
    ...actual,
    useAuthStore: (selector: (state: { signOut: unknown }) => unknown) =>
      selector({ signOut }),
  }
})

const renderForm = () =>
  render(
    <MemoryRouter>
      <ChangePasswordForm />
    </MemoryRouter>
  )

const fields = () => {
  const inputs = document.querySelectorAll('form input')
  return {
    current: inputs[0],
    next: inputs[1],
    repeat: inputs[2],
  }
}

const type = (input: Element, value: string) => {
  fireEvent.change(input, { target: { value } })
}

const fill = (current: string, next: string, repeat: string) => {
  type(fields().current, current)
  type(fields().next, next)
  type(fields().repeat, repeat)
}

const submit = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Сменить пароль' }))
}

/**
 * Форма смены пароля (ТЗ §А5).
 *
 * Главное свойство, ради которого тест и написан: успешная смена ЗАКРЫВАЕТ сессию. Сервер
 * отзывает refresh-токены владельца, и форма, оставившая человека в приложении, приводила
 * бы его к отказам через минуту-другую.
 */
describe('ChangePasswordForm', () => {
  afterEach(() => {
    cleanup()
    requestChangePassword.mockReset()
    signOut.mockReset()
    window.localStorage.clear()
  })

  it('гасит кнопку, пока не заполнены все три поля', () => {
    window.localStorage.setItem('webbuh.auth.accessToken', 'token')
    renderForm()
    const button = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Сменить пароль',
    })
    expect(button.disabled).toBe(true)

    fill('Старый12345', 'Новый12345', '')
    expect(button.disabled).toBe(true)

    type(fields().repeat, 'Новый12345')
    expect(button.disabled).toBe(false)
  })

  it('не отправляет на сервер расходящийся повтор — это опечатка в этой форме', () => {
    window.localStorage.setItem('webbuh.auth.accessToken', 'token')
    renderForm()

    fill('Старый12345', 'Новый12345', 'Новый12346')
    submit()

    expect(screen.getByText('Новый пароль и повтор не совпадают')).toBeTruthy()
    expect(requestChangePassword).not.toHaveBeenCalled()
  })

  it('после успешной смены закрывает сессию', async () => {
    window.localStorage.setItem('webbuh.auth.accessToken', 'token')
    requestChangePassword.mockResolvedValue(undefined)
    signOut.mockResolvedValue(undefined)
    renderForm()

    fill('Старый12345', 'Новый12345', 'Новый12345')
    submit()

    await waitFor(() => {
      expect(requestChangePassword).toHaveBeenCalledWith(
        'token',
        'Старый12345',
        'Новый12345'
      )
    })
    await waitFor(() => {
      expect(signOut).toHaveBeenCalled()
    })
  })

  it('показывает текст отказа с сервера дословно', async () => {
    window.localStorage.setItem('webbuh.auth.accessToken', 'token')
    requestChangePassword.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 401,
        data: { message: 'Текущий пароль указан неверно' },
      },
    })
    renderForm()

    fill('не тот', 'Новый12345', 'Новый12345')
    submit()

    expect(
      await screen.findByText('Текущий пароль указан неверно')
    ).toBeTruthy()
    expect(signOut).not.toHaveBeenCalled()
  })
})
