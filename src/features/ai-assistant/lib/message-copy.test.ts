import { describe, expect, it } from 'vitest'
import type { AssistantChatMessage } from './hooks/use-assistant-session'
import { assistantMessageCopyText, failedQuestionFor } from './message-copy'

const user: AssistantChatMessage = {
  id: 'u',
  role: 'USER',
  text: 'Проверь документ',
  createdAt: '2026-09-11T01:00:00Z',
}
const error: AssistantChatMessage = {
  id: 'e',
  role: 'ASSISTANT',
  text: '',
  error: 'Сеть недоступна',
  createdAt: user.createdAt,
}
describe('message copy and failed question', () => {
  it('copies structured visible content as plain text', () => {
    expect(
      assistantMessageCopyText({
        ...error,
        error: undefined,
        answer: {
          conversationId: 1,
          conclusion: 'Итог',
          breakdown: [{ label: 'Сумма', value: '100' }],
          sources: ['Источник'],
          missing: 'Нет данных',
          created: [
            {
              typeCode: 'Test',
              entryId: 1,
              presentation: 'Документ',
              posted: false,
              warnings: ['Проверить дату'],
            },
          ],
          actions: [
            { kind: 'POST_DOCUMENT', label: 'Провести', error: 'Нет прав' },
          ],
          latencyMs: 1,
        },
      })
    ).toBe(
      'Итог\nСумма: 100\nИсточник\nНет данных\nДокумент\nПроверить дату\nНет прав'
    )
  })
  it('offers only the immediate previous user question, never a distant one', () => {
    expect(failedQuestionFor([user, error], 1)).toBe(user.text)
    expect(
      failedQuestionFor([user, error, { ...error, id: 'e2' }], 2)
    ).toBeNull()
    expect(failedQuestionFor([error], 0)).toBeNull()
    expect(assistantMessageCopyText(user)).toBe(user.text)
    expect(assistantMessageCopyText(error)).toBe(error.error)
  })
})
