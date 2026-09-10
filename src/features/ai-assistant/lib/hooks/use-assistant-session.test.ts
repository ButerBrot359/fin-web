import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type {
  AiAssistantAnswer,
  AiAssistantContext,
} from '@/entities/ai-assistant'
import { useAssistantSession } from './use-assistant-session'

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }))
vi.mock('@/entities/ai-assistant', () => ({
  useAskAssistant: () => ({ mutate: mocks.mutate, isPending: false }),
}))

const answer: AiAssistantAnswer = {
  conversationId: 1,
  conclusion: 'Готово',
  breakdown: [],
  sources: [],
  actions: [],
  created: [],
  latencyMs: 1,
}
const context: AiAssistantContext = {
  kind: 'DOCUMENT',
  typeCode: 'OperatsiyaBukh',
  entryId: 1,
}
const callbacks = () =>
  mocks.mutate.mock.calls[0][1] as {
    onSuccess: (value: AiAssistantAnswer) => void
  }

describe('useAssistantSession', () => {
  beforeEach(() => mocks.mutate.mockReset())

  it('не отправляет один запрос дважды до перерендера', () => {
    const { result } = renderHook(() => useAssistantSession(context))
    act(() => {
      result.current.send('Создай копию')
      result.current.send('Создай копию')
    })
    expect(mocks.mutate).toHaveBeenCalledTimes(1)
  })

  it('не смешивает диалоги и не открывает документ из запоздавшего ответа', () => {
    const onAnswer = vi.fn()
    const { result, rerender } = renderHook(
      ({ value }) => useAssistantSession(value, onAnswer),
      { initialProps: { value: context } }
    )
    act(() => {
      result.current.send('Создай копию')
    })
    const pending = callbacks()
    rerender({ value: { ...context, entryId: 2 } })
    expect(result.current.messages).toEqual([])
    act(() => {
      pending.onSuccess(answer)
    })
    expect(result.current.messages).toEqual([])
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('сброс не восстанавливается запоздавшим ответом', () => {
    const { result } = renderHook(() => useAssistantSession(context))
    act(() => {
      result.current.send('Вопрос')
    })
    const pending = callbacks()
    act(() => {
      result.current.reset()
    })
    act(() => {
      pending.onSuccess(answer)
    })
    expect(result.current.messages).toEqual([])
  })

  it('после ответа продолжает тот же серверный диалог', () => {
    const { result } = renderHook(() => useAssistantSession(context))
    act(() => {
      result.current.send('Вопрос')
    })
    act(() => {
      callbacks().onSuccess(answer)
    })
    act(() => {
      result.current.send('Уточнение')
    })
    expect(mocks.mutate.mock.calls[1][0]).toMatchObject({
      conversationId: 1,
      question: 'Уточнение',
    })
  })
  it('показывает время сразу и уточняет его по серверу после ответа', () => {
    const { result } = renderHook(() => useAssistantSession(context))
    act(() => {
      result.current.send('Вопрос')
    })
    expect(Number.isNaN(Date.parse(result.current.messages[0].createdAt))).toBe(
      false
    )
    act(() => {
      callbacks().onSuccess({
        ...answer,
        userCreatedAt: '2026-09-10T09:00:00+05:00',
        createdAt: '2026-09-10T09:01:30+05:00',
      })
    })
    expect(result.current.messages[0].createdAt).toBe(
      '2026-09-10T09:00:00+05:00'
    )
    expect(result.current.messages[1].createdAt).toBe(
      '2026-09-10T09:01:30+05:00'
    )
  })
})
