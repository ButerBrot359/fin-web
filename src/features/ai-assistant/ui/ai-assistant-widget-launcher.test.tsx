import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { openAiWidget } from '@/shared/lib/widgets/widget-launchers'
import { AiAssistantWidget } from './ai-assistant-widget'

const session = vi.hoisted(() => ({
  messages: [{ id: 'saved', text: 'Сохранённый ответ' }],
  send: vi.fn(),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ pageCode: 'Main' }),
}))
vi.mock('@/entities/ai-assistant', () => ({
  useAiAssistantSettings: () => ({
    settings: { enabled: true, capabilities: [] },
  }),
  useConfirmAssistantAction: () => ({ isPending: false }),
}))
vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: vi.fn() }))
vi.mock('../lib/hooks/use-assistant-print', () => ({
  useAssistantPrint: () => ({ isPending: false }),
}))
vi.mock('../lib/hooks/use-form-context', () => ({
  useFormContext: () => ({ kind: 'GENERAL' }),
}))
vi.mock('../lib/hooks/use-restored-assistant-session', () => ({
  useRestoredAssistantSession: () => session,
}))
vi.mock('./ai-assistant-panel', () => ({
  AiAssistantPanel: ({
    open,
    messages,
    onClose,
  }: {
    open: boolean
    messages: { text: string }[]
    onClose: () => void
  }) =>
    open ? (
      <div data-testid="panel">
        {messages[0].text}
        <button onClick={onClose}>close panel</button>
      </div>
    ) : null,
}))
afterEach(cleanup)
it('header command reopens the existing conversation once without sending a new question', () => {
  render(<AiAssistantWidget />)
  const fab = screen.getByRole('button', { hidden: true })
  expect(fab.closest('[style*="display: none"]')).not.toBeNull()
  act(openAiWidget)
  act(openAiWidget)
  expect(screen.getAllByTestId('panel')).toHaveLength(1)
  expect(screen.getByTestId('panel').textContent).toContain('Сохранённый ответ')
  fireEvent.click(screen.getByText('close panel'))
  act(openAiWidget)
  expect(screen.getByTestId('panel').textContent).toContain('Сохранённый ответ')
  expect(session.send).not.toHaveBeenCalled()
})
