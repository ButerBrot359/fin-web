import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useToolbarMutations } from './use-toolbar-mutations'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: vi.fn() }))
vi.mock('@/features/sdui', () => ({ openMovementsForEntry: vi.fn() }))

const api = vi.hoisted(() => ({
  postDocumentEntry: vi.fn(),
  unpostDocumentEntry: vi.fn(),
}))
vi.mock('@/entities/document-entry', () => api)

// Колбэк вотчера перехватываем, чтобы сыграть завершение фоновой задачи
const watcher = vi.hoisted(() => ({
  callback: null as ((task: unknown) => void) | null,
}))
vi.mock('@/entities/async-task', () => ({
  useTaskCompletionWatcher: (cb: (task: unknown) => void) => {
    watcher.callback = cb
    return { watch: vi.fn() }
  },
}))

const showRecalculationNotices = vi.hoisted(() => vi.fn())
vi.mock('@/entities/recalculation-notice', () => ({
  showRecalculationNotices,
}))

const NOTICES = [
  { kind: 'STALE', message: 'Пересчитайте амортизацию за сентябрь.' },
]

const renderMutations = () =>
  renderHook(() => useToolbarMutations(), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        children
      ),
  })

beforeEach(() => {
  vi.clearAllMocks()
  watcher.callback = null
})

describe('useToolbarMutations: recalculationNotices (SCRUM-330, ADR-0079)', () => {
  it('синхронное проведение (200) показывает уведомления из document', async () => {
    api.postDocumentEntry.mockResolvedValue({
      data: {
        async: false,
        document: { id: 101, isPosted: true, recalculationNotices: NOTICES },
        task: null,
      },
    })
    const { result } = renderMutations()
    result.current.post.mutate(101)
    await waitFor(() => {
      expect(showRecalculationNotices).toHaveBeenCalledWith(
        NOTICES,
        expect.any(Function)
      )
    })
  })

  it('202 (в фон) уведомлений не показывает — они приедут с задачей', async () => {
    api.postDocumentEntry.mockResolvedValue({
      data: {
        async: true,
        document: null,
        task: { id: 't-1', status: 'QUEUED', recalculationNotices: [] },
      },
    })
    const { result } = renderMutations()
    result.current.post.mutate(101)
    await waitFor(() => {
      expect(api.postDocumentEntry).toHaveBeenCalled()
    })
    expect(showRecalculationNotices).not.toHaveBeenCalled()
  })

  it('SUCCEEDED-задача вотчера показывает свои уведомления', () => {
    renderMutations()
    watcher.callback?.({
      id: 't-1',
      status: 'SUCCEEDED',
      recalculationNotices: NOTICES,
    })
    expect(showRecalculationNotices).toHaveBeenCalledWith(
      NOTICES,
      expect.any(Function)
    )
  })

  it('FAILED-задача уведомлений не показывает (операция не состоялась)', () => {
    renderMutations()
    watcher.callback?.({ id: 't-1', status: 'FAILED', errorMessage: 'x' })
    expect(showRecalculationNotices).not.toHaveBeenCalled()
  })

  it('отмена проведения показывает уведомления из data.data', async () => {
    api.unpostDocumentEntry.mockResolvedValue({
      data: {
        data: { id: 101, isPosted: false, recalculationNotices: NOTICES },
        success: true,
      },
    })
    const { result } = renderMutations()
    result.current.unpost.mutate(101)
    await waitFor(() => {
      expect(showRecalculationNotices).toHaveBeenCalledWith(
        NOTICES,
        expect.any(Function)
      )
    })
  })
})
