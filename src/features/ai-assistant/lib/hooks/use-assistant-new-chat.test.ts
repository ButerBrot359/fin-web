import type * as SessionPersistence from '../session-persistence'
import { beforeEach as resetStorage } from 'vitest'
resetStorage(() => {
  sessionStorage.clear()
})
vi.mock('../session-persistence', async (importOriginal) => ({
  ...(await importOriginal<typeof SessionPersistence>()),
  useAssistantOwnerKey: () => 'test-owner',
}))
import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { AiAssistantAnswer } from '@/entities/ai-assistant'
import { useRestoredAssistantSession } from './use-restored-assistant-session'
const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  queriedIds: [] as (number | null)[],
}))
vi.mock('@/entities/ai-assistant', () => ({
  useAskAssistant: () => ({ mutate: mocks.mutate, isPending: false }),
  useAiConversations: () => ({
    conversations: [{ id: 42 }],
    isSuccess: true,
    isError: false,
    isFetching: false,
  }),
  useAiConversationMessages: (id: number | null) => {
    mocks.queriedIds.push(id)
    return {
      messages:
        id === 42
          ? [
              {
                id: 20,
                role: 'ASSISTANT',
                content: 'Старая история',
                createdAt: '',
              },
            ]
          : [],
      olderMessages:
        id === 42
          ? [{ id: 10, role: 'USER', content: 'Старый вопрос', createdAt: '' }]
          : [],
      pageCount: id === 42 ? 2 : 0,
      isSuccess: true,
      isError: false,
      isFetching: false,
    }
  },
}))
const context = {
  kind: 'DOCUMENT' as const,
  typeCode: 'OperatsiyaBukh',
  entryId: 1,
}
const answer: AiAssistantAnswer = {
  conversationId: 99,
  conclusion: 'Новый ответ',
  breakdown: [],
  sources: [],
  actions: [],
  created: [],
  latencyMs: 1,
}
beforeEach(() => {
  mocks.mutate.mockReset()
  mocks.queriedIds.length = 0
})
it('starts an intentionally empty chat and sends null ID without restoring cached old pages', () => {
  const { result, rerender } = renderHook(() =>
    useRestoredAssistantSession(context, true)
  )
  expect(result.current.conversationId).toBe(42)
  act(() => {
    result.current.startNewChat()
  })
  expect(result.current.messages).toEqual([])
  expect(result.current.conversationId).toBeNull()
  expect(result.current.isRestored).toBe(true)
  rerender()
  expect(mocks.queriedIds.at(-1)).toBeNull()
  expect(result.current.messages).toEqual([])
  act(() => {
    result.current.send('Новый вопрос')
  })
  expect(mocks.mutate.mock.calls[0][0]).toMatchObject({
    conversationId: null,
    question: 'Новый вопрос',
  })
  expect(result.current.messages.map((message) => message.text)).toEqual([
    'Новый вопрос',
  ])
})
it('ignores old success and error callbacks after starting a new chat', () => {
  const onAnswer = vi.fn()
  const { result } = renderHook(() =>
    useRestoredAssistantSession(context, true, onAnswer)
  )
  act(() => {
    result.current.send('Старый запрос')
  })
  const old = mocks.mutate.mock.calls[0][1] as {
    onSuccess: (value: AiAssistantAnswer) => void
    onError: (error: Error) => void
  }
  act(() => {
    result.current.startNewChat()
  })
  act(() => {
    old.onSuccess(answer)
    old.onError(new Error('Старая ошибка'))
  })
  expect(result.current.messages).toEqual([])
  expect(result.current.conversationId).toBeNull()
  expect(onAnswer).not.toHaveBeenCalled()
  act(() => {
    result.current.send('Следующий вопрос')
  })
  expect(mocks.mutate.mock.calls[1][0]).toMatchObject({ conversationId: null })
  const current = mocks.mutate.mock.calls[1][1] as {
    onSuccess: (value: AiAssistantAnswer) => void
  }
  act(() => {
    current.onSuccess(answer)
  })
  expect(result.current.messages.map((message) => message.text)).toEqual([
    'Следующий вопрос',
    'Новый ответ',
  ])
  expect(result.current.conversationId).toBe(99)
})
