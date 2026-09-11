import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  AnalyticsGenerateRequest,
  AnalyticsGenerateResponse,
  AnalyticsConversation,
} from '@/entities/analytics/types/assistant'
import type { AnalyticsItemKind, AnalyticsSpec } from '@/entities/analytics'
import { useAssistantSession } from './use-assistant-session'
const mocks = vi.hoisted(() => ({
  userId: 1,
  mutate: vi.fn<
    (
      request: AnalyticsGenerateRequest,
      callbacks: {
        onSuccess: (response: AnalyticsGenerateResponse) => void
        onError: (error: unknown) => void
      }
    ) => void
  >(),
  getConversation:
    vi.fn<
      (id: number, signal?: AbortSignal) => Promise<AnalyticsConversation>
    >(),
}))
vi.mock('@/features/auth/lib/hooks/use-auth-store', () => ({
  useAuthStore: (select: (state: { user: { id: number } }) => unknown) =>
    select({ user: { id: mocks.userId } }),
}))
vi.mock('@/entities/analytics', () => ({
  useGenerateSpec: () => ({ mutate: mocks.mutate, isPending: false }),
}))
vi.mock('@/entities/analytics/api/analytics-api', () => ({
  analyticsApi: { getConversation: mocks.getConversation },
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'ru' }, t: (key: string) => key }),
}))
const spec = (kind: AnalyticsItemKind): AnalyticsSpec => ({
  specVersion: 1,
  layout: { columns: 12, rowHeight: 80 },
  kind,
  title: 'Ready',
  parameters: [],
  datasets: [],
  widgets: [],
  sourceViews: [],
})
const response = (
  patch: Partial<AnalyticsGenerateResponse> = {}
): AnalyticsGenerateResponse => ({
  conversationId: 42,
  messageId: 2,
  spec: null,
  warnings: [],
  ...patch,
})
const key = (kind: AnalyticsItemKind, user = 1) =>
  `analytics-assistant-v1:${window.location.origin}:${String(user)}:${kind}`
beforeEach(() => {
  sessionStorage.clear()
  mocks.userId = 1
  mocks.mutate.mockReset()
  mocks.getConversation.mockReset()
})
describe('analytics workspace sessions', () => {
  it('sends a selected clarification in the same mode and conversation', () => {
    const { result } = renderHook(() => useAssistantSession('REPORT'))
    act(() => {
      result.current.send('Help')
    })
    act(() => {
      mocks.mutate.mock.calls[0][1].onSuccess(
        response({
          status: 'CLARIFICATION',
          questions: [{ id: 'period', text: 'Period?', options: ['Month'] }],
        })
      )
    })
    act(() => {
      result.current.send('Period?: Month')
    })
    expect(mocks.mutate.mock.calls[1][0]).toMatchObject({
      kind: 'REPORT',
      conversationId: 42,
      prompt: 'Period?: Month',
      currentSpec: null,
    })
    expect(result.current.messages[1].questions?.[0].options).toEqual(['Month'])
  })
  it('preserves the latest valid matching preview after failure and wrong-kind output', () => {
    const { result } = renderHook(() => useAssistantSession('DASHBOARD'))
    act(() => {
      result.current.send('Build')
    })
    act(() => {
      mocks.mutate.mock.calls[0][1].onSuccess(
        response({ status: 'READY', spec: spec('DASHBOARD') })
      )
    })
    const ready = result.current.currentSpec
    act(() => {
      result.current.send('Change')
    })
    act(() => {
      mocks.mutate.mock.calls[1][1].onSuccess(
        response({
          messageId: 4,
          status: 'FAILED',
          error: 'Invalid',
          spec: spec('REPORT'),
        })
      )
    })
    expect(result.current.currentSpec).toBe(ready)
    expect(result.current.messages.at(-1)?.spec).toBeNull()
  })
  it('restores only the account and mode ID and rich clarification metadata', async () => {
    sessionStorage.setItem(key('REPORT'), '42')
    sessionStorage.setItem(key('DASHBOARD'), '99')
    mocks.getConversation.mockResolvedValue({
      id: 42,
      kind: 'REPORT',
      createdAt: '2026-09-11T00:00:00',
      messages: [
        {
          id: 1,
          role: 'ASSISTANT',
          content: 'Clarify',
          createdAt: '2026-09-11T01:02:03',
          status: 'CLARIFICATION',
          questions: [{ id: 'q', text: 'Period?', options: ['Month'] }],
          suggestions: ['Explain'],
        },
      ],
    })
    const { result } = renderHook(() => useAssistantSession('REPORT'))
    await waitFor(() => {
      expect(result.current.isRestoring).toBe(false)
    })
    expect(mocks.getConversation.mock.calls[0][0]).toBe(42)
    expect(result.current.messages[0]).toMatchObject({
      createdAt: '2026-09-11T01:02:03',
      status: 'CLARIFICATION',
      suggestions: ['Explain'],
    })
    expect(result.current.conversationId).toBe(42)
  })
  it('rejects a saved conversation of another mode without mixing its messages', async () => {
    sessionStorage.setItem(key('REPORT'), '99')
    mocks.getConversation.mockResolvedValue({
      id: 99,
      kind: 'DASHBOARD',
      createdAt: '',
      messages: [],
    })
    const { result } = renderHook(() => useAssistantSession('REPORT'))
    await waitFor(() => {
      expect(result.current.restoreError).toBeTruthy()
    })
    expect(result.current.messages).toEqual([])
    expect(result.current.currentSpec).toBeNull()
    expect(sessionStorage.getItem(key('REPORT'))).toBeNull()
  })
  it('new chat and account switch both reject delayed callbacks', () => {
    const { result, rerender } = renderHook(() => useAssistantSession('REPORT'))
    act(() => {
      result.current.send('First')
    })
    const old = mocks.mutate.mock.calls[0][1]
    act(() => {
      result.current.reset()
      old.onSuccess(response({ spec: spec('REPORT') }))
    })
    expect(result.current.messages).toEqual([])
    act(() => {
      result.current.send('Second')
    })
    mocks.userId = 2
    rerender()
    act(() => {
      mocks.mutate.mock.calls[1][1].onSuccess(
        response({ spec: spec('REPORT') })
      )
    })
    expect(result.current.messages).toEqual([])
    expect(sessionStorage.getItem(key('REPORT', 2))).toBeNull()
  })
  it('does not repeat sends before React renders pending state', () => {
    const { result } = renderHook(() => useAssistantSession('DASHBOARD'))
    act(() => {
      result.current.send('Build')
      result.current.send('Build')
    })
    expect(mocks.mutate).toHaveBeenCalledOnce()
  })
  it('uses acknowledged user and assistant IDs and timestamps for reload parity', () => {
    const { result } = renderHook(() => useAssistantSession('REPORT'))
    act(() => {
      result.current.send('Build')
    })
    act(() => {
      mocks.mutate.mock.calls[0][1].onSuccess(
        response({
          userMessageId: 1,
          userCreatedAt: '2026-09-11T14:00:00',
          createdAt: '2026-09-11T14:00:10',
        })
      )
    })
    expect(
      result.current.messages.map((message) => [message.id, message.createdAt])
    ).toEqual([
      ['stored-1', '2026-09-11T14:00:00'],
      ['stored-2', '2026-09-11T14:00:10'],
    ])
  })
  it('uses the last backend request ID for the live audit button', () => {
    const { result } = renderHook(() => useAssistantSession('DASHBOARD'))
    act(() => {
      result.current.send('Build')
    })
    act(() => {
      mocks.mutate.mock.calls[0][1].onSuccess(
        response({ llmRequestIds: [101, 102], llmRequestId: 100 })
      )
    })
    expect(result.current.messages.at(-1)?.llmRequestId).toBe(102)
  })
})
