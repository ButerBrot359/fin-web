import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ActiveCallBar } from './active-call-bar'
const calls = vi.hoisted(() => ({
  toggle: vi.fn(),
  disconnect: vi.fn(),
  restore: vi.fn(),
  hangUp: vi.fn(),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@livekit/components-react', () => ({
  useRemoteParticipants: () => [{ name: 'Оператор', identity: 'agent' }],
  useTrackToggle: () => ({
    enabled: true,
    pending: false,
    toggle: calls.toggle,
  }),
  useRoomContext: () => ({ disconnect: calls.disconnect }),
}))
vi.mock('../lib/call-sounds', () => ({
  callSounds: {
    micOff: vi.fn(),
    micOn: vi.fn(),
    restore: vi.fn(),
    hangUp: vi.fn(),
  },
}))
vi.mock('./screen-share-badge', () => ({
  ScreenShareBadge: () => <span>Показ экрана продолжается</span>,
}))
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      disconnect = vi.fn()
    }
  )
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})
it('restoring and toggling microphone never disconnect the minimized live room', () => {
  render(
    <ActiveCallBar
      seconds={125}
      onRestore={calls.restore}
      onHangUp={calls.hangUp}
      position={{ x: 50, y: 70 }}
    />
  )
  expect(screen.getByTestId('active-call-bar').style.left).toBe('50px')
  expect(screen.getByTestId('active-call-bar').style.top).toBe('70px')
  expect(screen.getByText('02:05')).toBeTruthy()
  expect(screen.getByText('Оператор')).toBeTruthy()
  expect(screen.getByText('Показ экрана продолжается')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'support.micOff' }))
  expect(calls.toggle).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'support.miniRestore' }))
  expect(calls.restore).toHaveBeenCalledOnce()
  expect(calls.disconnect).not.toHaveBeenCalled()
  expect(calls.hangUp).not.toHaveBeenCalled()
})
it('ending a call declares user intent before disconnecting the existing room', () => {
  render(
    <ActiveCallBar
      seconds={0}
      onRestore={calls.restore}
      onHangUp={calls.hangUp}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'support.leave' }))
  expect(calls.hangUp).toHaveBeenCalledOnce()
  expect(calls.disconnect).toHaveBeenCalledOnce()
  expect(calls.hangUp.mock.invocationCallOrder[0]).toBeLessThan(
    calls.disconnect.mock.invocationCallOrder[0]
  )
})
