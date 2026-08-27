import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  fetchTask,
  useAsyncTaskStore,
  type AsyncTask,
} from '@/entities/async-task'

import { TASK_POLL_INTERVAL_MS, useTaskWatcher } from './use-task-watcher'

const dispatchMock = vi.hoisted(() => vi.fn())
vi.mock('../dispatch', () => ({ useSduiDispatch: () => dispatchMock }))

vi.mock('@/entities/async-task', async (importOriginal) => {
  const orig = await importOriginal<Record<string, unknown>>()
  return { ...orig, fetchTask: vi.fn() }
})

function makeTask(status: AsyncTask['status']): AsyncTask {
  return { id: 't1', kind: 'DOCUMENT_POST', title: 'Проведение', status }
}

describe('useTaskWatcher (SCRUM-330 §3.3–3.4)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    useAsyncTaskStore.setState({ entries: {} })
    dispatchMock.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('обновляет задачу по опросу; нетерминальный статус — рапорта нет', async () => {
    useAsyncTaskStore.getState().track(makeTask('QUEUED'), 'fs-1')
    vi.mocked(fetchTask).mockResolvedValue(makeTask('RUNNING'))

    renderHook(() => {
      useTaskWatcher('fs-1')
    })
    await vi.advanceTimersByTimeAsync(TASK_POLL_INTERVAL_MS)

    expect(useAsyncTaskStore.getState().entries.t1.task.status).toBe('RUNNING')
    expect(dispatchMock).not.toHaveBeenCalled()
  })

  it('терминальный статус → COMMAND task.finished:<id> БЕЗ статуса, задача снята', async () => {
    useAsyncTaskStore.getState().track(makeTask('RUNNING'), 'fs-1')
    vi.mocked(fetchTask).mockResolvedValue(makeTask('SUCCEEDED'))

    renderHook(() => {
      useTaskWatcher('fs-1')
    })
    await vi.advanceTimersByTimeAsync(TASK_POLL_INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(0)

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'task.finished:t1',
    })
    expect(useAsyncTaskStore.getState().entries.t1).toBeUndefined()
  })

  it('404 на опросе → тоже рапорт task.finished (сервер вернёт кнопки)', async () => {
    useAsyncTaskStore.getState().track(makeTask('RUNNING'), 'fs-1')
    vi.mocked(fetchTask).mockRejectedValue({ status: 404, error: 'NOT_FOUND' })

    renderHook(() => {
      useTaskWatcher('fs-1')
    })
    await vi.advanceTimersByTimeAsync(TASK_POLL_INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(0)

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'task.finished:t1',
    })
  })

  it('сетевая ошибка опроса — молчим и ждём следующего тика', async () => {
    useAsyncTaskStore.getState().track(makeTask('RUNNING'), 'fs-1')
    vi.mocked(fetchTask).mockRejectedValue(new Error('network'))

    renderHook(() => {
      useTaskWatcher('fs-1')
    })
    await vi.advanceTimersByTimeAsync(TASK_POLL_INTERVAL_MS)

    expect(dispatchMock).not.toHaveBeenCalled()
    expect(useAsyncTaskStore.getState().entries.t1).toBeDefined()
  })

  it('неуспех рапорта возвращает задачу под опрос — повтор на следующем тике', async () => {
    useAsyncTaskStore.getState().track(makeTask('RUNNING'), 'fs-1')
    vi.mocked(fetchTask).mockResolvedValue(makeTask('SUCCEEDED'))
    dispatchMock.mockResolvedValueOnce(false).mockResolvedValue(true)

    renderHook(() => {
      useTaskWatcher('fs-1')
    })
    await vi.advanceTimersByTimeAsync(TASK_POLL_INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(0)
    expect(dispatchMock).toHaveBeenCalledTimes(1)
    expect(useAsyncTaskStore.getState().entries.t1).toBeDefined()

    await vi.advanceTimersByTimeAsync(TASK_POLL_INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(0)
    expect(dispatchMock).toHaveBeenCalledTimes(2)
    expect(useAsyncTaskStore.getState().entries.t1).toBeUndefined()
  })

  it('чужая сессия не поллится', async () => {
    useAsyncTaskStore.getState().track(makeTask('RUNNING'), 'fs-OTHER')

    renderHook(() => {
      useTaskWatcher('fs-1')
    })
    await vi.advanceTimersByTimeAsync(TASK_POLL_INTERVAL_MS)

    expect(fetchTask).not.toHaveBeenCalled()
  })

  it('unmount снимает задачи своей сессии с поллинга', () => {
    useAsyncTaskStore.getState().track(makeTask('RUNNING'), 'fs-1')
    const { unmount } = renderHook(() => {
      useTaskWatcher('fs-1')
    })
    unmount()
    expect(useAsyncTaskStore.getState().entries.t1).toBeUndefined()
  })
})
