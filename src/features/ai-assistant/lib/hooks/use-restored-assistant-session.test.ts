import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiConversationMessage } from '@/entities/ai-assistant'
import {
  restoreChatMessages,
  useRestoredAssistantSession,
} from './use-restored-assistant-session'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
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
vi.mock('@/entities/ai-assistant', () => ({
  useAskAssistant: () => ({ mutate: mocks.mutate, isPending: false }),
  useAiConversations: () => ({ ...mocks.history, retry: mocks.retry }),
  useAiConversationMessages: () => ({ ...mocks.stored, retry: mocks.retry }),
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
})
