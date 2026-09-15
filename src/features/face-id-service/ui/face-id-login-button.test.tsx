import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import '@/app/config/i18n'

import { getFaceIdAvailability } from '../api/face-id-api'
import { FaceIdLoginButton } from './face-id-login-button'

vi.mock('../api/face-id-api', () => ({ getFaceIdAvailability: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe('Face ID identify button', () => {
  it('is available without entering a login when server enables identify', async () => {
    vi.mocked(getFaceIdAvailability).mockResolvedValue({
      enabled: true,
      identifyEnabled: true,
    })
    render(<FaceIdLoginButton returnPath={null} />)
    const button = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Вход по face id',
    })
    await waitFor(() => {
      expect(button.disabled).toBe(false)
    })
  })

  it('stays disabled when server status cannot be obtained', async () => {
    vi.mocked(getFaceIdAvailability).mockRejectedValue(new Error('network'))
    render(<FaceIdLoginButton returnPath={null} />)
    await screen.findByText(
      'Face ID пока недоступен. Используйте другой способ входа.'
    )
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Вход по face id' })
        .disabled
    ).toBe(true)
  })
})
