import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/app/config/i18n'

const mocks = vi.hoisted(() => ({ complete: vi.fn(), signIn: vi.fn() }))
vi.mock('@/features/auth', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ completeSignIn: mocks.signIn }),
}))
vi.mock('@/features/face-id-service/api/face-id-api', () => ({
  completeFaceId: mocks.complete,
  startFaceId: vi.fn(),
}))

import { FaceIdCallbackPage } from './face-id-callback-page'

const state = 's'.repeat(43)
const code = 'c'.repeat(43)

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.clearAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('Face ID callback', () => {
  it('performs one exchange under StrictMode and strips sensitive query immediately', async () => {
    window.history.replaceState(
      null,
      '',
      `/auth/face-id/callback?state=${state}&code=${code}`
    )
    sessionStorage.setItem(
      `webbuh.face-id.${state}`,
      JSON.stringify({
        browserToken: 'p'.repeat(43),
        returnPath: '/',
        expiresAt: Date.now() + 300_000,
      })
    )
    const tokens = { user: { login: 'Test user' } }
    mocks.complete.mockResolvedValue(tokens)
    render(
      <StrictMode>
        <MemoryRouter>
          <FaceIdCallbackPage />
        </MemoryRouter>
      </StrictMode>
    )
    expect(window.location.search).toBe('')
    await waitFor(() => {
      expect(mocks.signIn).toHaveBeenCalledExactlyOnceWith(tokens, 'Test user')
    })
    expect(mocks.complete).toHaveBeenCalledTimes(1)
    expect(sessionStorage.length).toBe(0)
  })

  it('does not exchange unbound callback, offers restart without displaying code', async () => {
    window.history.replaceState(
      null,
      '',
      `/auth/face-id/callback?state=${state}&code=${code}`
    )
    render(
      <MemoryRouter>
        <FaceIdCallbackPage />
      </MemoryRouter>
    )
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Вернуться ко входу' })
    ).toBeTruthy()
    expect(document.body.textContent).not.toContain(code)
    expect(mocks.complete).not.toHaveBeenCalled()
    expect(mocks.signIn).not.toHaveBeenCalled()
  })
})
