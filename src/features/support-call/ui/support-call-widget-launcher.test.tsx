import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openSupportWidget } from '@/shared/lib/widgets/widget-launchers'
import { SupportCallWidget } from './support-call-widget'

const state = vi.hoisted(() => ({
  user: { supportAgent: false } as { supportAgent: boolean } | null,
  restored: null as { callId: number } | null,
  queue: [] as { id: number; status: string }[],
  queueHook: vi.fn(),
  end: vi.fn(),
  join: vi.fn(),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/features/auth/lib/hooks/use-auth-store', () => ({
  useAuthStore: (select: (value: { user: typeof state.user }) => unknown) =>
    select({ user: state.user }),
}))
vi.mock('../model/use-support-call', () => ({
  useActiveSupportSession: () => ({ data: state.restored }),
  useEndSupportCall: () => ({ mutate: state.end }),
  useJoinSupportCall: () => ({ mutate: state.join }),
  useSupportQueue: (enabled: boolean) => {
    state.queueHook(enabled)
    return { data: state.queue }
  },
}))
vi.mock('./caller-dialog', () => ({
  CallerDialog: () => <div data-testid="caller" />,
}))
vi.mock('./support-queue-dialog', () => ({
  SupportQueueDialog: () => <div data-testid="queue" />,
}))
vi.mock('./call-room-dialog', () => ({
  CallRoomDialog: ({ session }: { session: { callId: number } }) => (
    <div data-testid="room">{session.callId}</div>
  ),
}))
vi.mock('./incoming-call-card', () => ({
  IncomingCallCard: ({ call }: { call: { id: number } }) => (
    <div data-testid="incoming">{call.id}</div>
  ),
}))

afterEach(cleanup)
beforeEach(() => {
  state.user = { supportAgent: false }
  state.restored = null
  state.queue = []
  vi.clearAllMocks()
})
describe('support header launcher uses the mounted widget', () => {
  it('opens caller for a regular user while keeping the old launcher mounted but hidden', () => {
    render(<SupportCallWidget />)
    const fab = screen.getByRole('button', { hidden: true })
    expect(fab.parentElement?.style.display).toBe('none')
    act(openSupportWidget)
    act(openSupportWidget)
    expect(screen.getAllByTestId('caller')).toHaveLength(1)
    expect(screen.queryByTestId('queue')).toBeNull()
    expect(state.join).not.toHaveBeenCalled()
  })
  it('opens the agent queue and continues observing incoming calls despite hidden launcher', () => {
    state.user = { supportAgent: true }
    state.queue = [{ id: 17, status: 'WAITING' }]
    render(<SupportCallWidget />)
    expect(screen.getByTestId('incoming').textContent).toBe('17')
    expect(state.queueHook).toHaveBeenCalledWith(true)
    act(openSupportWidget)
    expect(screen.getByTestId('queue')).toBeTruthy()
    expect(screen.getByTestId('incoming')).toBeTruthy()
    expect(screen.queryByTestId('caller')).toBeNull()
  })
  it('restores the existing session before offering either caller or agent queue', () => {
    state.user = { supportAgent: true }
    state.restored = { callId: 42 }
    render(<SupportCallWidget />)
    act(openSupportWidget)
    act(openSupportWidget)
    expect(screen.getAllByTestId('room')).toHaveLength(1)
    expect(screen.getByTestId('room').textContent).toBe('42')
    expect(screen.queryByTestId('caller')).toBeNull()
    expect(screen.queryByTestId('queue')).toBeNull()
    expect(state.join).not.toHaveBeenCalled()
    expect(state.end).not.toHaveBeenCalled()
  })
  it('does not open support for an unauthenticated user', () => {
    state.user = null
    render(<SupportCallWidget />)
    act(openSupportWidget)
    expect(screen.queryByTestId('caller')).toBeNull()
    expect(screen.queryByTestId('room')).toBeNull()
  })
})
