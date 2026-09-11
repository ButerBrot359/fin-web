import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AssistantComposer } from './assistant-composer'
import { AssistantResultCard } from './assistant-result-card'
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'ru' }, t: (key: string) => key }),
}))
afterEach(cleanup)
describe('analytics dialogue controls', () => {
  it('supports multiline Enter without sending during IME composition', () => {
    const submit = vi.fn()
    render(
      <AssistantComposer
        kind="REPORT"
        value="Question"
        onChange={vi.fn()}
        onSubmit={submit}
        isPending={false}
      />
    )
    const input = screen.getByTestId('analytics-composer-input')
    expect(input.tagName).toBe('TEXTAREA')
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(submit).not.toHaveBeenCalled()
    fireEvent.compositionStart(input)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(submit).not.toHaveBeenCalled()
    fireEvent.compositionEnd(input)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(submit).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole('button', {
        name: 'analytics.assistant.kindDashboard',
      })
    ).toBeNull()
  })
  it('shows each real clarification once and sends its selected answer as text', () => {
    const reply = vi.fn()
    render(
      <AssistantResultCard
        message={{
          id: '1',
          role: 'ASSISTANT',
          text: 'Давайте уточним\nЗа какой период?',
          status: 'CLARIFICATION',
          questions: [
            {
              id: 'period',
              text: 'За какой период?',
              options: ['Этот год', 'Прошлый год'],
            },
          ],
          suggestions: ['Помоги выбрать'],
        }}
        settingsPath="/settings"
        onShowPayload={vi.fn()}
        onReply={reply}
      />
    )
    expect(screen.getAllByText('За какой период?')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Этот год' }))
    expect(reply).toHaveBeenCalledWith('За какой период?: Этот год')
    fireEvent.click(screen.getByRole('button', { name: /Помоги выбрать/ }))
    expect(reply).toHaveBeenCalledWith('Помоги выбрать')
  })
  it('does not send another choice while the current response is pending', () => {
    const reply = vi.fn()
    render(
      <AssistantResultCard
        message={{
          id: '1',
          role: 'ASSISTANT',
          text: '',
          questions: [{ id: 'period', text: 'Период', options: ['Этот год'] }],
        }}
        settingsPath="/settings"
        onShowPayload={vi.fn()}
        onReply={reply}
        disabled
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Этот год' }))
    expect(reply).not.toHaveBeenCalled()
  })
})
