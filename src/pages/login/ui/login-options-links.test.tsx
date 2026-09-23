import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import '@/app/config/i18n'

import type * as AuthModule from '@/features/auth'
import type { LoginOptions } from '@/shared/types/auth.types'

import { LoginForm } from './login-form'

vi.mock('@/features/face-id-service', () => ({ FaceIdLoginButton: () => null }))
vi.mock('@/features/face-auth', () => ({ FaceLoginButton: () => null }))
vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<typeof AuthModule>('@/features/auth')
  return {
    ...actual,
    useAuthStore: (selector: (state: { signIn: unknown }) => unknown) =>
      selector({ signIn: vi.fn() }),
  }
})

const loginOptionsMock = vi.hoisted(() => vi.fn())
vi.mock('@/shared/api/auth/password-recovery-endpoints', () => ({
  requestLoginOptions: loginOptionsMock,
}))

const renderForm = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    </QueryClientProvider>
  )

afterEach(cleanup)

const options = (over: Partial<LoginOptions>): LoginOptions => ({
  showHelpLink: false,
  helpUrl: null,
  showForgotPasswordLink: false,
  ...over,
})

describe('Экран входа: login-options (SCRUM-355 §2.1)', () => {
  it('showForgotPasswordLink → ссылка «Забыли пароль?» на /password-recovery', async () => {
    loginOptionsMock.mockResolvedValue(
      options({ showForgotPasswordLink: true })
    )
    renderForm()
    const link = await screen.findByText('Забыли пароль?')
    expect(link.closest('a')?.getAttribute('href')).toBe('/password-recovery')
  })

  it('обе ссылки выключены → ничего не рисуется', async () => {
    loginOptionsMock.mockResolvedValue(options({}))
    renderForm()
    await waitFor(() => {
      expect(loginOptionsMock).toHaveBeenCalled()
    })
    expect(screen.queryByText('Забыли пароль?')).toBeNull()
    expect(screen.queryByText('Помощь при входе')).toBeNull()
  })

  it('helpUrl null при showHelpLink true — ссылку не рисуем (адрес не задан)', async () => {
    loginOptionsMock.mockResolvedValue(
      options({
        showHelpLink: true,
        helpUrl: null,
        showForgotPasswordLink: true,
      })
    )
    renderForm()
    await screen.findByText('Забыли пароль?')
    expect(screen.queryByText('Помощь при входе')).toBeNull()
  })

  it('helpUrl задан → внешняя ссылка помощи', async () => {
    loginOptionsMock.mockResolvedValue(
      options({ showHelpLink: true, helpUrl: 'https://help.example.kz' })
    )
    renderForm()
    const link = await screen.findByText('Помощь при входе')
    expect(link.closest('a')?.getAttribute('href')).toBe(
      'https://help.example.kz'
    )
  })
})
