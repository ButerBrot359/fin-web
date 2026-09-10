import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiAssistantAnswer } from '../../types/ai-assistant'
import { useAskAssistant, useConfirmAssistantAction } from './use-ai-assistant'

const mocks = vi.hoisted(() => ({
  mutation: vi.fn(),
  invalidate: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('@tanstack/react-query', () => ({
  useMutation: mocks.mutation,
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('../../api/ai-assistant-api', () => ({ aiAssistantApi: {} }))
vi.mock('@/shared/lib/refresh/open-views-refresh', () => ({
  requestOpenViewsRefresh: mocks.refresh,
}))
vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: mocks.toast }))
const answer = (patch: Partial<AiAssistantAnswer>): AiAssistantAnswer => ({
  conversationId: 1,
  conclusion: '',
  breakdown: [],
  sources: [],
  actions: [],
  created: [],
  latencyMs: 1,
  ...patch,
})
const settled = () =>
  (
    mocks.mutation.mock.calls[0][0] as {
      onSettled: (answer?: AiAssistantAnswer) => Promise<void>
    }
  ).onSettled

describe('assistant refresh integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.refresh.mockResolvedValue({ refreshed: 1, deferred: 0, failed: 0 })
  })
  it('после правки справочника обновляет открытые формы и кэш истории даже без created', async () => {
    renderHook(() => useAskAssistant())
    await settled()(
      answer({
        actions: [{ kind: 'UPDATE_DICTIONARY_ENTRY', preview: 'Изменено' }],
      })
    )
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(mocks.invalidate).toHaveBeenCalledWith({
      queryKey: ['ai-assistant', 'conversation'],
    })
  })
  it('ответ без мутаций не переоткрывает форму', async () => {
    renderHook(() => useAskAssistant())
    await settled()(answer({}))
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
  it('подтверждение тоже обновляет формы и сообщает об отложенном обновлении', async () => {
    mocks.refresh.mockResolvedValue({ refreshed: 0, deferred: 1, failed: 0 })
    renderHook(() => useConfirmAssistantAction())
    await settled()()
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(mocks.toast).toHaveBeenCalledWith(
      'warning',
      'aiAssistant.refreshDeferred'
    )
  })
})
