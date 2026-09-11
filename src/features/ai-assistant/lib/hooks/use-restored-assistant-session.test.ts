import type * as SessionPersistence from '../session-persistence'
import { beforeEach as resetStorage } from 'vitest'
resetStorage(() => {
  sessionStorage.clear()
})
vi.mock('../session-persistence', async (importOriginal) => ({
  ...(await importOriginal<typeof SessionPersistence>()),
  useAssistantOwnerKey: () => mocks.owner,
}))
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  AiConversationMessage,
  AiAssistantAnswer,
  AiAssistantChatRequest,
} from '@/entities/ai-assistant'
import {
  restoreChatMessages,
  useRestoredAssistantSession,
} from './use-restored-assistant-session'

const mocks = vi.hoisted(() => ({
  owner: 'test-owner',
  mutate: vi.fn<
    (
      request: AiAssistantChatRequest,
      callbacks: {
        onSuccess: (answer: AiAssistantAnswer) => void
        onError: (error: unknown) => void
      }
    ) => void
  >(),
  getRequest: vi.fn(),
  translate: (key: string) => key,
  retry: vi.fn(),
  history: {
    conversations: [] as { id: number }[],
    isSuccess: false,
    isError: false,
  },
  stored: {
    messages: [] as AiConversationMessage[],
    isSuccess: false,
    isError: false,
  },
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mocks.translate }),
}))
vi.mock('@/entities/ai-assistant', () => ({
  useAskAssistant: () => ({ mutate: mocks.mutate, isPending: false }),
  useAiConversations: () => ({ ...mocks.history, retry: mocks.retry }),
  useAiConversationMessages: () => ({
    olderMessages: [],
    ...mocks.stored,
    retry: mocks.retry,
  }),
}))
vi.mock('@/entities/ai-assistant/api/ai-assistant-api', () => ({
  aiAssistantApi: { getRequest: mocks.getRequest },
}))
const context = {
  kind: 'DOCUMENT' as const,
  typeCode: 'OperatsiyaBukh',
  entryId: 1,
}
const storedMessage = (
  patch: Partial<AiConversationMessage>
): AiConversationMessage => ({
  id: 1,
  role: 'ASSISTANT',
  content: 'Ответ',
  createdAt: '',
  ...patch,
})

describe('restored assistant session', () => {
  beforeEach(() => {
    mocks.owner = 'test-owner'
    mocks.getRequest.mockReset()
    mocks.mutate.mockReset()
    mocks.retry.mockReset()
    mocks.history = { conversations: [], isSuccess: false, isError: false }
    mocks.stored = { messages: [], isSuccess: false, isError: false }
  })

  it('ждёт историю до отправки и продолжает найденный диалог', () => {
    const { result, rerender } = renderHook(() =>
      useRestoredAssistantSession(context, true)
    )
    act(() => {
      result.current.send('Ранний вопрос')
    })
    expect(mocks.mutate).not.toHaveBeenCalled()
    mocks.history = {
      conversations: [{ id: 42 }],
      isSuccess: true,
      isError: false,
    }
    rerender()
    act(() => {
      result.current.send('Пока сообщения загружаются')
    })
    expect(mocks.mutate).not.toHaveBeenCalled()
    mocks.stored = {
      messages: [storedMessage({ content: 'Старый ответ' })],
      isSuccess: true,
      isError: false,
    }
    rerender()
    expect(result.current.messages[0].text).toBe('Старый ответ')
    act(() => {
      result.current.send('Продолжение')
    })
    expect(mocks.mutate.mock.calls[0][0]).toMatchObject({
      conversationId: 42,
      question: 'Продолжение',
    })
  })

  it('пустая история разрешает новый диалог и не зацикливает render', () => {
    mocks.history.isSuccess = true
    const { result } = renderHook(() =>
      useRestoredAssistantSession(context, true)
    )
    expect(result.current.historyLoading).toBe(false)
    act(() => {
      result.current.send('Новый вопрос')
    })
    expect(mocks.mutate).toHaveBeenCalledOnce()
  })

  it('ошибка загрузки не создаёт новый диалог поверх старого', () => {
    mocks.history.isError = true
    const { result } = renderHook(() =>
      useRestoredAssistantSession(context, true)
    )
    expect(result.current.historyError).toBe(true)
    act(() => {
      result.current.send('Вопрос')
      result.current.retryHistory()
    })
    expect(mocks.mutate).not.toHaveBeenCalled()
    expect(mocks.retry).toHaveBeenCalledOnce()
  })

  it('сохраняет полную карточку ответа, пользовательский JSON и ошибки', () => {
    const restored = restoreChatMessages([
      storedMessage({
        id: 1,
        role: 'USER',
        content: '{"needData":"это мой вопрос"}',
      }),
      storedMessage({
        id: 2,
        answer: {
          conclusion: 'Готово',
          breakdown: [{ label: 'Итого', value: '100' }],
          sources: ['Документ'],
          created: [
            {
              entryId: 7,
              typeCode: 'OperatsiyaBukh',
              presentation: 'Операция',
              posted: true,
              warnings: ['Проверить'],
            },
          ],
        },
      }),
      storedMessage({ id: 3, error: 'Провайдер недоступен' }),
      storedMessage({ id: 4, role: 'TOOL', content: 'служебные данные' }),
    ])
    expect(restored).toHaveLength(3)
    expect(restored[0].text).toContain('needData')
    expect(restored[1].answer?.breakdown).toHaveLength(1)
    expect(restored[1].answer?.created[0].warnings).toEqual(['Проверить'])
    expect(restored[2].error).toBe('Провайдер недоступен')
  })

  it('старый JSON только с conclusion получает безопасные пустые массивы', () => {
    const [restored] = restoreChatMessages([
      storedMessage({ answer: { conclusion: 'Старый ответ' } }),
    ])
    expect(restored.answer).toMatchObject({
      conclusion: 'Старый ответ',
      breakdown: [],
      actions: [],
      created: [],
      sources: [],
    })
  })
  it('не восстанавливает устаревший кэш до завершения перечитывания', () => {
    mocks.history = {
      conversations: [{ id: 42 }],
      isSuccess: true,
      isError: false,
    }
    mocks.stored = {
      messages: [storedMessage({ content: 'Устаревший ответ' })],
      isSuccess: true,
      isError: false,
    }
    Object.assign(mocks.stored, { isFetching: true })
    const { result, rerender } = renderHook(() =>
      useRestoredAssistantSession(context, true)
    )
    expect(result.current.messages).toHaveLength(0)
    expect(result.current.historyLoading).toBe(true)
    Object.assign(mocks.stored, {
      isFetching: false,
      messages: [storedMessage({ content: 'Новый ответ' })],
    })
    rerender()
    expect(result.current.messages[0].text).toBe('Новый ответ')
  })
  it('добавляет старую страницу перед перепиской и не дублирует её при перерендерах', () => {
    mocks.history = {
      conversations: [{ id: 42 }],
      isSuccess: true,
      isError: false,
    }
    mocks.stored = {
      messages: [storedMessage({ id: 20, content: 'Последнее' })],
      isSuccess: true,
      isError: false,
    }
    Object.assign(mocks.stored, { pageCount: 1, olderMessages: [] })
    const { result, rerender } = renderHook(() =>
      useRestoredAssistantSession(context, true)
    )
    act(() => {
      result.current.send('Локальный вопрос')
    })
    Object.assign(mocks.stored, {
      pageCount: 2,
      olderMessages: [storedMessage({ id: 10, content: 'Предыдущее' })],
    })
    rerender()
    expect(result.current.messages.map((message) => message.text)).toEqual([
      'Предыдущее',
      'Последнее',
      'Локальный вопрос',
    ])
    rerender()
    expect(result.current.messages).toHaveLength(3)
  })
  it('сохраняет серверное время при восстановлении страницы истории', () => {
    const [message] = restoreChatMessages([
      storedMessage({ createdAt: '2026-09-09T23:59:00+05:00' }),
    ])
    expect(message.createdAt).toBe('2026-09-09T23:59:00+05:00')
  })
  it('reload keeps active conversation independently of page context', () => {
    sessionStorage.setItem(
      'ai-assistant-session-v1:test-owner',
      JSON.stringify({ conversationId: 77, explicitNew: false })
    )
    mocks.stored = {
      messages: [storedMessage({ id: 8, content: 'Retained' })],
      isSuccess: true,
      isError: false,
    }
    const { result, rerender } = renderHook(
      ({ id }) =>
        useRestoredAssistantSession({ ...context, entryId: id }, true),
      { initialProps: { id: 1 } }
    )
    expect(result.current.conversationId).toBe(77)
    rerender({ id: 2 })
    expect(result.current.messages[0].text).toBe('Retained')
    expect(result.current.conversationId).toBe(77)
  })
  it('pending reload polls readonly recovery and never repeats ask', async () => {
    vi.useFakeTimers()
    try {
      sessionStorage.setItem(
        'ai-assistant-session-v1:test-owner',
        JSON.stringify({
          conversationId: 42,
          explicitNew: false,
          pending: { requestId: 'pending-id', startedAt: Date.now() },
        })
      )
      mocks.stored = {
        messages: [storedMessage({ id: 1, role: 'USER', content: 'Вопрос' })],
        isSuccess: true,
        isError: false,
      }
      mocks.getRequest
        .mockResolvedValueOnce({
          status: 'RUNNING',
          conversationId: 42,
          userMessageId: 1,
        })
        .mockResolvedValueOnce({
          status: 'COMPLETED',
          conversationId: 42,
          userMessageId: 1,
        })
      const { result, rerender, unmount } = renderHook(() =>
        useRestoredAssistantSession(context, true)
      )
      await act(async () => {
        await Promise.resolve()
      })
      expect(result.current.isPending).toBe(true)
      expect(result.current.pendingStartedAt).toBeTypeOf('number')
      expect(result.current.messages[0].text).toBe('Вопрос')
      mocks.stored.messages = [
        ...mocks.stored.messages,
        storedMessage({
          id: 2,
          content: 'Сохранённый ответ',
          answer: { conclusion: 'Сохранённый ответ' },
        }),
      ]
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })
      rerender()
      expect(result.current.messages.map((message) => message.id)).toEqual([
        'stored-1',
        'stored-2',
      ])
      expect(mocks.mutate).not.toHaveBeenCalled()
      expect(mocks.getRequest).toHaveBeenCalledTimes(2)
      expect(
        (
          JSON.parse(
            sessionStorage.getItem('ai-assistant-session-v1:test-owner')!
          ) as { pending?: unknown }
        ).pending
      ).toBeUndefined()
      unmount()
    } finally {
      vi.useRealTimers()
    }
  })
  it('merges refreshed server IDs without duplicate live answers or older pages', () => {
    mocks.history = {
      conversations: [{ id: 42 }],
      isSuccess: true,
      isError: false,
    }
    mocks.stored = {
      messages: [storedMessage({ id: 1, content: 'Original' })],
      isSuccess: true,
      isError: false,
    }
    const { result, rerender } = renderHook(() =>
      useRestoredAssistantSession(context, true)
    )
    act(() => {
      result.current.send('Question')
    })
    act(() => {
      mocks.mutate.mock.calls[0][1].onSuccess({
        conversationId: 42,
        userMessageId: 2,
        assistantMessageId: 3,
        conclusion: 'Live',
        breakdown: [],
        created: [],
        actions: [],
        sources: [],
        latencyMs: 1,
      })
    })
    mocks.stored.messages = [
      storedMessage({ id: 1, content: 'Original' }),
      storedMessage({ id: 2, role: 'USER', content: 'Question' }),
      storedMessage({ id: 3, content: 'Live' }),
    ]
    rerender()
    expect(result.current.messages.map((message) => message.id)).toEqual([
      'stored-1',
      'stored-2',
      'stored-3',
    ])
  })
  it('new chat remains empty after reload even when previous history exists', () => {
    mocks.history = {
      conversations: [{ id: 42 }],
      isSuccess: true,
      isError: false,
    }
    mocks.stored = {
      messages: [storedMessage({ id: 8, content: 'Old' })],
      isSuccess: true,
      isError: false,
    }
    const first = renderHook(() => useRestoredAssistantSession(context, true))
    act(() => {
      first.result.current.startNewChat()
    })
    first.unmount()
    const second = renderHook(() => useRestoredAssistantSession(context, true))
    expect(second.result.current.messages).toEqual([])
    expect(second.result.current.conversationId).toBeNull()
  })
  it('account change clears messages and rejects delayed callback from previous account', () => {
    mocks.history = { conversations: [], isSuccess: true, isError: false }
    const { result, rerender } = renderHook(() =>
      useRestoredAssistantSession(context, true)
    )
    act(() => {
      result.current.send('Account one secret')
    })
    const callback = mocks.mutate.mock.calls[0][1]
    mocks.owner = 'another-account'
    rerender()
    act(() => {
      callback.onSuccess({
        conversationId: 42,
        conclusion: 'Private',
        created: [],
        actions: [],
        sources: [],
        breakdown: [],
        latencyMs: 1,
      })
    })
    expect(result.current.messages).toEqual([])
    expect(result.current.conversationId).toBeNull()
  })
  it('unknown pending request preserves its one question and offers retry without replay', async () => {
    vi.useFakeTimers()
    try {
      sessionStorage.setItem(
        'ai-assistant-session-v1:test-owner',
        JSON.stringify({
          conversationId: null,
          explicitNew: false,
          pending: {
            requestId: 'unknown',
            startedAt: Date.now(),
            question: 'Unacknowledged question',
            createdAt: '2026-09-11T00:00:00Z',
          },
        })
      )
      mocks.getRequest.mockRejectedValue(new Error('404'))
      const { result, unmount } = renderHook(() =>
        useRestoredAssistantSession(context, true)
      )
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10001)
      })
      expect(result.current.historyError).toBe(true)
      expect(result.current.messages[0].text).toBe('Unacknowledged question')
      expect(mocks.mutate).not.toHaveBeenCalled()
      expect(
        sessionStorage.getItem('ai-assistant-session-v1:test-owner')
      ).toContain('Unacknowledged question')
      unmount()
    } finally {
      vi.useRealTimers()
    }
  })
  it('current-tab transport error recovers saved answer and removes provisional error', async () => {
    mocks.history = { conversations: [], isSuccess: true, isError: false }
    mocks.getRequest.mockResolvedValue({
      status: 'COMPLETED',
      conversationId: 42,
      userMessageId: 1,
      userCreatedAt: '2026-09-11T00:00:00Z',
    })
    const { result, rerender } = renderHook(() =>
      useRestoredAssistantSession(context, true)
    )
    act(() => {
      result.current.send('Question')
    })
    mocks.stored = {
      messages: [
        storedMessage({ id: 1, role: 'USER', content: 'Question' }),
        storedMessage({
          id: 2,
          content: 'Saved',
          answer: { conclusion: 'Saved' },
        }),
      ],
      isSuccess: true,
      isError: false,
    }
    await act(async () => {
      mocks.mutate.mock.calls[0][1].onError(new Error('Network lost'))
      await Promise.resolve()
    })
    rerender()
    expect(result.current.messages.map((message) => message.id)).toEqual([
      'stored-1',
      'stored-2',
    ])
    expect(result.current.messages.some((message) => message.error)).toBe(false)
    expect(mocks.mutate).toHaveBeenCalledTimes(1)
  })
  it('RUNNING before registration keeps the unacknowledged question through another reload', async () => {
    sessionStorage.setItem(
      'ai-assistant-session-v1:test-owner',
      JSON.stringify({
        conversationId: null,
        explicitNew: false,
        pending: {
          requestId: 'before-registration',
          startedAt: 123,
          question: 'Keep question',
          createdAt: '2026-09-11T00:00:00Z',
        },
      })
    )
    mocks.getRequest.mockResolvedValue({
      status: 'RUNNING',
      conversationId: null,
      userMessageId: null,
    })
    const first = renderHook(() => useRestoredAssistantSession(context, true))
    await act(async () => {
      await Promise.resolve()
    })
    expect(first.result.current.messages[0].text).toBe('Keep question')
    expect(
      sessionStorage.getItem('ai-assistant-session-v1:test-owner')
    ).toContain('Keep question')
    first.unmount()
    const second = renderHook(() => useRestoredAssistantSession(context, true))
    await act(async () => {
      await Promise.resolve()
    })
    expect(second.result.current.messages[0].text).toBe('Keep question')
    expect(mocks.mutate).not.toHaveBeenCalled()
    second.unmount()
  })
  it('interrupted reply without server error shows stable localized warning', async () => {
    sessionStorage.setItem(
      'ai-assistant-session-v1:test-owner',
      JSON.stringify({
        conversationId: 42,
        explicitNew: false,
        pending: { requestId: 'interrupted', startedAt: 123 },
      })
    )
    mocks.stored = {
      messages: [storedMessage({ id: 1, role: 'USER', content: 'Question' })],
      isSuccess: true,
      isError: false,
    }
    mocks.getRequest.mockResolvedValue({
      status: 'INTERRUPTED',
      conversationId: 42,
      userMessageId: 1,
      error: null,
    })
    const { result, unmount } = renderHook(() =>
      useRestoredAssistantSession(context, true)
    )
    await act(async () => {
      await Promise.resolve()
    })
    const warning = result.current.messages.find((message) => message.error)
    expect(warning?.error).toBe('aiAssistant.requestInterrupted')
    expect(warning?.createdAt).toBe(new Date(123).toISOString())
    expect(mocks.mutate).not.toHaveBeenCalled()
    unmount()
  })
})
