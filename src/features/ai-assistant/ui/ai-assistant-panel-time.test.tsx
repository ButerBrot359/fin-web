import type { ComponentProps } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { AiAssistantPanel } from './ai-assistant-panel'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ru' } }),
}))
vi.mock('./assistant-composer', () => ({ AssistantComposer: () => null }))
vi.mock('./assistant-context-bar', () => ({ AssistantContextBar: () => null }))
vi.mock('./assistant-help', () => ({ AssistantHelp: () => null }))
vi.mock('./assistant-panel-header', () => ({
  AssistantPanelHeader: () => null,
}))
vi.mock('./assistant-presets', () => ({ AssistantPresets: () => null }))
vi.mock('./assistant-answer-card', () => ({ AssistantAnswerCard: () => null }))
afterEach(cleanup)

const props: ComponentProps<typeof AiAssistantPanel> = {
  open: true,
  minimized: false,
  enlarged: false,
  helpOpen: false,
  onToggleHelp: vi.fn(),
  onToggleSize: vi.fn(),
  context: { kind: 'NONE' },
  capabilities: [],
  isPending: false,
  onClose: vi.fn(),
  onToggleMinimize: vi.fn(),
  onSend: vi.fn(),
  onAction: vi.fn(),
  onOpenDocument: vi.fn(),
  messages: [
    {
      id: 'user',
      role: 'USER',
      text: 'Question',
      createdAt: new Date(2026, 8, 10, 9, 5).toISOString(),
    },
    {
      id: 'answer',
      role: 'ASSISTANT',
      text: 'Answer',
      createdAt: new Date(2026, 8, 10, 9, 6).toISOString(),
    },
    {
      id: 'error',
      role: 'ASSISTANT',
      text: '',
      error: 'Failed',
      createdAt: new Date(2026, 8, 11, 10, 7).toISOString(),
    },
  ],
}

it('renders times for user, assistant and error messages with accessible full dates', () => {
  const view = render(<AiAssistantPanel {...props} />)
  const times = [...view.container.querySelectorAll('time[title]')]
  expect(times.map((time) => time.textContent)).toEqual([
    '09:05',
    '09:06',
    '10:07',
  ])
  expect(
    times.every((time) => time.getAttribute('title')?.includes('2026'))
  ).toBe(true)
  expect(times[0].getAttribute('datetime')).toBe(props.messages[0].createdAt)
  expect(view.getAllByRole('separator')).toHaveLength(2)
  for (const message of view.container.querySelectorAll(
    '[data-assistant-message-id]'
  )) {
    expect(message.querySelectorAll('time[title]')).toHaveLength(1)
    // A removed duplicate date header must not move the scroll anchor inside a message.
    expect(message.querySelector('[role="separator"]')).toBeNull()
  }
})

it('keeps an undated legacy message readable without an invalid timestamp', () => {
  const view = render(
    <AiAssistantPanel
      {...props}
      messages={[
        {
          id: 'legacy',
          role: 'ASSISTANT',
          text: 'Legacy answer',
          createdAt: 'bad date',
        },
      ]}
    />
  )
  expect(view.getByText('Legacy answer')).toBeTruthy()
  expect(view.container.querySelector('time')).toBeNull()
  expect(view.queryByText('Invalid Date')).toBeNull()
})
