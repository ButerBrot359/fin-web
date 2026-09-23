import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import '@/app/config/i18n'

import type * as AuthModule from '@/features/auth'

import { PasswordRecoveryPage } from './password-recovery-page'
import { PasswordRecoveryLinkPage } from './password-recovery-link-page'

// В vitest svg-импорт резолвится строкой data:—URL, а не компонентом
vi.mock('@/shared/assets/logo.svg', () => ({ default: () => null }))

const signOut = vi.fn().mockResolvedValue(undefined)
vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<typeof AuthModule>('@/features/auth')
  return {
    ...actual,
    useAuthStore: (selector: (state: { signOut: unknown }) => unknown) =>
      selector({ signOut }),
  }
})

const api = vi.hoisted(() => ({
  requestPasswordRecovery: vi.fn(),
  verifyPasswordRecoveryCode: vi.fn(),
  verifyPasswordRecoveryLink: vi.fn(),
  completePasswordRecovery: vi.fn(),
  requestLoginOptions: vi.fn(),
}))
vi.mock('@/shared/api/auth/password-recovery-endpoints', () => api)

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('PasswordRecoveryPage (SCRUM-355 §3.1)', () => {
  it('шаг 1 → 2: текст ответа сервера показывается как есть', async () => {
    api.requestPasswordRecovery.mockResolvedValue({
      message: 'Если адрес зарегистрирован, письмо отправлено',
    })
    wrap(<PasswordRecoveryPage />)
    fireEvent.change(screen.getByLabelText(/Электронная почта/), {
      target: { value: 'user@example.kz' },
    })
    fireEvent.click(screen.getByText('Получить код'))
    expect(
      await screen.findByText('Если адрес зарегистрирован, письмо отправлено')
    ).toBeTruthy()
    expect(screen.getByLabelText(/Код из письма/)).toBeTruthy()
    // mutationFn получает вторым аргументом контекст TanStack Query
    expect(api.requestPasswordRecovery).toHaveBeenCalledWith(
      'user@example.kz',
      expect.anything()
    )
  })

  it('шаг 2 → 3: верный код ведёт к форме пароля, тикет уходит в complete', async () => {
    api.requestPasswordRecovery.mockResolvedValue({ message: 'ок' })
    api.verifyPasswordRecoveryCode.mockResolvedValue({ ticket: 't-1' })
    api.completePasswordRecovery.mockResolvedValue(undefined)
    wrap(<PasswordRecoveryPage />)
    fireEvent.change(screen.getByLabelText(/Электронная почта/), {
      target: { value: 'user@example.kz' },
    })
    fireEvent.click(screen.getByText('Получить код'))
    fireEvent.change(await screen.findByLabelText(/Код из письма/), {
      target: { value: '12345678' },
    })
    fireEvent.click(screen.getByText('Подтвердить'))
    const newPass = await screen.findByLabelText(/Новый пароль/)
    fireEvent.change(newPass, { target: { value: 'Secret-123' } })
    fireEvent.change(screen.getByLabelText(/Повторите новый пароль/), {
      target: { value: 'Secret-123' },
    })
    fireEvent.click(screen.getByText('Установить пароль'))
    await vi.waitFor(() => {
      expect(api.completePasswordRecovery).toHaveBeenCalledWith(
        't-1',
        'Secret-123'
      )
    })
    // Все сессии отозваны — локальное состояние чистится
    expect(signOut).toHaveBeenCalled()
  })

  it('несовпадение пароля и повтора ловится на клиенте, запрос не уходит', async () => {
    api.requestPasswordRecovery.mockResolvedValue({ message: 'ок' })
    api.verifyPasswordRecoveryCode.mockResolvedValue({ ticket: 't-1' })
    wrap(<PasswordRecoveryPage />)
    fireEvent.change(screen.getByLabelText(/Электронная почта/), {
      target: { value: 'user@example.kz' },
    })
    fireEvent.click(screen.getByText('Получить код'))
    fireEvent.change(await screen.findByLabelText(/Код из письма/), {
      target: { value: '1' },
    })
    fireEvent.click(screen.getByText('Подтвердить'))
    fireEvent.change(await screen.findByLabelText(/Новый пароль/), {
      target: { value: 'a' },
    })
    fireEvent.change(screen.getByLabelText(/Повторите новый пароль/), {
      target: { value: 'b' },
    })
    fireEvent.click(screen.getByText('Установить пароль'))
    expect(
      await screen.findByText('Новый пароль и повтор не совпадают')
    ).toBeTruthy()
    expect(api.completePasswordRecovery).not.toHaveBeenCalled()
  })
})

describe('PasswordRecoveryLinkPage (SCRUM-355 §3.2)', () => {
  it('token из адреса уходит в verify-link и стирается из URL', async () => {
    api.verifyPasswordRecoveryLink.mockResolvedValue({ ticket: 't-9' })
    window.history.replaceState(null, '', '/password-recovery/link?token=abc')
    wrap(<PasswordRecoveryLinkPage />)
    await vi.waitFor(() => {
      expect(api.verifyPasswordRecoveryLink).toHaveBeenCalledWith(
        'abc',
        expect.anything()
      )
    })
    // §3.2: токен не должен утечь через историю браузера и Referer
    expect(window.location.search).toBe('')
    expect(await screen.findByLabelText(/Новый пароль/)).toBeTruthy()
  })

  it('401 на ссылке → внятный отказ и предложение запросить новую', async () => {
    api.verifyPasswordRecoveryLink.mockRejectedValue(
      Object.assign(new Error('unauthorized'), { status: 401 })
    )
    window.history.replaceState(null, '', '/password-recovery/link?token=old')
    wrap(<PasswordRecoveryLinkPage />)
    expect(
      await screen.findByText('Ссылка недействительна или устарела')
    ).toBeTruthy()
    expect(screen.getByText('Запросить новое письмо')).toBeTruthy()
  })

  it('без token сразу отказ, verify-link не зовётся', async () => {
    window.history.replaceState(null, '', '/password-recovery/link')
    wrap(<PasswordRecoveryLinkPage />)
    expect(
      await screen.findByText('Ссылка недействительна или устарела')
    ).toBeTruthy()
    expect(api.verifyPasswordRecoveryLink).not.toHaveBeenCalled()
  })
})
