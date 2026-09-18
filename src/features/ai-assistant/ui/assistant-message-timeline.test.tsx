import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import '@/app/config/i18n'
import { AssistantMessageTimeline } from './assistant-message-timeline'

afterEach(cleanup)
it('keeps completed results visible alongside a later turn error', () => {
  render(
    <AssistantMessageTimeline
      messages={[
        {
          id: 'stored-2',
          role: 'ASSISTANT',
          text: 'Часть действий выполнена',
          createdAt: '2026-09-11T10:30:12+05:00',
          error: 'Модель не ответила на следующий шаг',
          answer: {
            conversationId: 1,
            conclusion: 'Часть действий выполнена',
            latencyMs: 100,
            breakdown: [{ label: 'Результат', value: 'Документ сохранён' }],
            sources: ['Сохранённый документ'],
            actions: [],
            created: [],
          },
        },
      ]}
      language="ru"
      disabled={false}
      onOpenDocument={vi.fn()}
    />
  )
  expect(screen.getByText('Часть действий выполнена')).toBeTruthy()
  expect(screen.getByText('Документ сохранён')).toBeTruthy()
  expect(screen.getByText('Сохранённый документ')).toBeTruthy()
  expect(screen.getByText('Модель не ответила на следующий шаг')).toBeTruthy()
})
