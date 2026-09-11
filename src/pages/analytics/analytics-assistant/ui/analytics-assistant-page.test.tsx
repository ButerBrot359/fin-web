import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AnalyticsAssistantPage } from './analytics-assistant-page'

const state = vi.hoisted(() => ({ pending: true, reset: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/features/analytics-assistant', () => ({
  useAssistantSession: () => ({
    messages: [{ id: '1', role: 'USER', text: 'Build chart' }],
    currentSpec: null,
    conversationId: 1,
    kind: 'DASHBOARD',
    isPending: state.pending,
    reset: state.reset,
    send: vi.fn(),
    setKind: vi.fn(),
  }),
  AssistantChat: () => null,
  AssistantComposer: () => null,
  LlmPayloadDialog: () => null,
  SaveItemDialog: () => null,
}))
vi.mock('@/features/workspace-tabs', () => ({
  useTabMeta: vi.fn(),
  useWorkspaceTabsStore: { getState: () => ({ closeTab: vi.fn() }) },
}))
vi.mock('@/widgets/page-header', () => ({ PageHeader: () => null }))
vi.mock('../lib/hooks/use-save-current-spec', () => ({
  useSaveCurrentSpec: () => ({ save: vi.fn(), isPending: false }),
}))
vi.mock('./assistant-preview', () => ({ AssistantPreview: () => null }))

describe('analytics assistant pending generation', () => {
  it('cannot reset a running generation, then allows a new chat after completion', () => {
    state.pending = true
    state.reset.mockClear()
    const { rerender } = render(
      <MemoryRouter>
        <AnalyticsAssistantPage />
      </MemoryRouter>
    )
    const button = screen.getByRole('button', {
      name: 'analytics.assistant.newChat',
    })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(button)
    expect(state.reset).not.toHaveBeenCalled()
    state.pending = false
    rerender(
      <MemoryRouter>
        <AnalyticsAssistantPage />
      </MemoryRouter>
    )
    expect((button as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(button)
    expect(state.reset).toHaveBeenCalledOnce()
  })
})
