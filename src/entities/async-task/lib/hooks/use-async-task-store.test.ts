import { beforeEach, describe, expect, it } from 'vitest'

import type { AsyncTask } from '../../types/async-task'
import { useAsyncTaskStore } from './use-async-task-store'

function makeTask(
  id: string,
  status: AsyncTask['status'] = 'QUEUED'
): AsyncTask {
  return { id, kind: 'DOCUMENT_POST', title: 'Проведение', status }
}

describe('useAsyncTaskStore', () => {
  beforeEach(() => {
    useAsyncTaskStore.setState({ entries: {} })
  })

  it('track/updateTask: обновление не трогает привязку к сессии', () => {
    const s = useAsyncTaskStore.getState()
    s.track(makeTask('t1'), 'fs-1')
    s.updateTask(makeTask('t1', 'RUNNING'))

    const entry = useAsyncTaskStore.getState().entries.t1
    expect(entry.task.status).toBe('RUNNING')
    expect(entry.formSessionId).toBe('fs-1')
  })

  it('updateTask незнакомой задачи — no-op (задача уже снята)', () => {
    useAsyncTaskStore.getState().updateTask(makeTask('ghost'))
    expect(useAsyncTaskStore.getState().entries.ghost).toBeUndefined()
  })

  it('markFinishing ставит и снимает флаг', () => {
    const s = useAsyncTaskStore.getState()
    s.track(makeTask('t1'), 'fs-1')
    s.markFinishing('t1', true)
    expect(useAsyncTaskStore.getState().entries.t1.finishing).toBe(true)
    useAsyncTaskStore.getState().markFinishing('t1', false)
    expect(useAsyncTaskStore.getState().entries.t1.finishing).toBe(false)
  })

  it('untrackSession снимает только задачи своей сессии', () => {
    const s = useAsyncTaskStore.getState()
    s.track(makeTask('t1'), 'fs-1')
    s.track(makeTask('t2'), 'fs-2')
    useAsyncTaskStore.getState().untrackSession('fs-1')

    const entries = useAsyncTaskStore.getState().entries
    expect(entries.t1).toBeUndefined()
    expect(entries.t2).toBeDefined()
  })
})
