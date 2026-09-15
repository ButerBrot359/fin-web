import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/app/config/i18n'

import { getFaceIdSettings, updateFaceIdSettings } from '../api/face-id-api'
import { FaceIdSettingsForm } from './face-id-settings-form'

vi.mock('../api/face-id-api', () => ({
  getFaceIdSettings: vi.fn(),
  updateFaceIdSettings: vi.fn(),
  faceIdHttpStatus: (error: { status?: number }) => error.status,
}))

const settings = {
  enabled: false,
  configured: true,
  experimentalAuthenticationAllowed: true,
  serviceUrl: 'https://faceid.qazyna.ai',
  callbackUrl: 'https://dev.qazyna.ai/auth/face-id/callback',
  managementMode: 'AUTHENTICATED',
}
const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FaceIdSettingsForm />
    </QueryClientProvider>
  )
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe('Face ID settings', () => {
  it('requires a reason and keeps saved confirmation after server cache update', async () => {
    vi.mocked(getFaceIdSettings).mockResolvedValue(settings)
    vi.mocked(updateFaceIdSettings).mockResolvedValue({
      ...settings,
      enabled: true,
    })
    mount()
    fireEvent.click(await screen.findByRole('switch'))
    const save = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Сохранить настройку',
    })
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Причина изменения'), {
      target: { value: 'Тестовый пилот' },
    })
    fireEvent.click(save)
    await waitFor(() => {
      expect(updateFaceIdSettings).toHaveBeenCalledExactlyOnceWith(
        true,
        'Тестовый пилот'
      )
    })
    expect(await screen.findByText('Настройка сохранена.')).toBeTruthy()
    expect(screen.getByRole<HTMLInputElement>('switch').checked).toBe(true)
  })

  it('does not allow enabling without server experimental opt-in', async () => {
    vi.mocked(getFaceIdSettings).mockResolvedValue({
      ...settings,
      experimentalAuthenticationAllowed: false,
    })
    mount()
    expect((await screen.findByRole<HTMLInputElement>('switch')).disabled).toBe(
      true
    )
    expect(updateFaceIdSettings).not.toHaveBeenCalled()
  })
})
