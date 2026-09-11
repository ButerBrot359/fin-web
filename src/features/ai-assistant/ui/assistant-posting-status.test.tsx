import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type * as AsyncTaskModule from '@/entities/async-task'
import '@/app/config/i18n'
import { AssistantAnswerCard } from './assistant-answer-card'

const mocks = vi.hoisted(() => ({ fetchTask: vi.fn(), refresh: vi.fn() }))
vi.mock('@/entities/async-task', async (importOriginal) => ({
  ...(await importOriginal<typeof AsyncTaskModule>()),
  fetchTask: mocks.fetchTask,
}))
vi.mock('@/shared/lib/refresh/open-views-refresh', () => ({
  requestOpenViewsRefresh: mocks.refresh,
}))

const draw = (posted = false) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  render(
    <QueryClientProvider client={client}>
      <AssistantAnswerCard
        answer={{
          conversationId: 1,
          conclusion: 'Операция принята',
          breakdown: [],
          sources: [],
          actions: [],
          latencyMs: 1,
          created: [
            {
              entryId: 42,
              typeCode: 'OperatsiyaBukh',
              presentation: 'Операция №15',
              posted,
              warnings: [],
              operationStatus: 'ACCEPTED',
              taskId: 'task-1',
              taskStatus: 'QUEUED',
            },
          ],
        }}
        onAction={vi.fn()}
        onOpenDocument={vi.fn()}
      />
    </QueryClientProvider>
  )
}

describe('AssistantPostingStatus', () => {
  beforeEach(() => {
    mocks.fetchTask.mockReset()
    mocks.refresh.mockReset().mockResolvedValue({ deferred: 0, failed: 0 })
  })
  afterEach(cleanup)

  it('перепроведение не считается завершённым по старому posted=true', async () => {
    mocks.fetchTask.mockResolvedValue({ id: 'task-1', status: 'RUNNING' })
    draw(true)
    await screen.findByText('проводится')
    expect(screen.getByRole('button', { name: 'Операция №15' })).toBeTruthy()
    expect(screen.queryByText('проведён')).toBeNull()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('завершение фонового проведения обновляет открытые страницы', async () => {
    mocks.fetchTask.mockResolvedValue({ id: 'task-1', status: 'SUCCEEDED' })
    draw()
    await screen.findByText('проведение завершено')
    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalledTimes(1)
    })
  })

  it('показывает фактическую ошибку задачи', async () => {
    mocks.fetchTask.mockResolvedValue({
      id: 'task-1',
      status: 'FAILED',
      errorMessage: 'Период закрыт',
    })
    draw()
    await screen.findByText('Период закрыт')
    expect(screen.getByText('ошибка проведения')).toBeTruthy()
    expect(screen.queryByText('проведение завершено')).toBeNull()
  })

  it('потерянная задача не выдаётся за успех, состояние можно проверить повторно', async () => {
    mocks.fetchTask
      .mockRejectedValueOnce({ status: 404 })
      .mockResolvedValue({ id: 'task-1', status: 'SUCCEEDED' })
    draw()
    await screen.findByText('Не удалось получить состояние операции')
    fireEvent.click(screen.getByRole('button', { name: 'Проверить состояние' }))
    await screen.findByText('проведение завершено')
    expect(mocks.fetchTask).toHaveBeenCalledTimes(2)
  })
})
