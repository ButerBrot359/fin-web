import { describe, expect, it, vi } from 'vitest'

import type { AsyncTask } from '@/entities/async-task'

import { taskStatusText } from './task-status-text'

// t() → ключ: проверяем ветвление, не переводы
vi.mock('i18next', () => ({ default: { t: (key: string) => key } }))
// Барель @/entities/async-task тянет tasks-api → apiService → инициализацию
// i18n, несовместимую с моком выше; транспорт здесь не нужен
vi.mock('@/shared/api/api', () => ({ apiService: {} }))

function makeTask(overrides: Partial<AsyncTask>): AsyncTask {
  return {
    id: 't1',
    kind: 'DOCUMENT_POST',
    title: 'Проведение',
    status: 'RUNNING',
    ...overrides,
  }
}

describe('taskStatusText', () => {
  it('QUEUED → «в очереди»', () => {
    expect(taskStatusText(makeTask({ status: 'QUEUED' }), false)).toBe(
      'backgroundTasks.queued'
    )
  })

  it('RUNNING с progressPercent — процент дописан', () => {
    const task = makeTask({
      progressMessage: 'Проведение начато',
      progressPercent: 35,
    })
    expect(taskStatusText(task, false)).toBe('Проведение начато — 35%')
  })

  it('RUNNING без progressTotal/percent — БЕЗ «0 %» (handoff §3.2)', () => {
    const task = makeTask({ progressTotal: null, progressPercent: null })
    expect(taskStatusText(task, false)).toBe('backgroundTasks.running')
  })

  it('cancelRequested при RUNNING → «отменяется», не «отменено»', () => {
    const task = makeTask({ cancelRequested: true })
    expect(taskStatusText(task, false)).toBe('backgroundTasks.cancelling')
  })

  it('после 202 на отмену (cancelPending) → «отменяется»', () => {
    expect(taskStatusText(makeTask({}), true)).toBe(
      'backgroundTasks.cancelling'
    )
  })

  it('терминальные статусы', () => {
    expect(taskStatusText(makeTask({ status: 'SUCCEEDED' }), false)).toBe(
      'backgroundTasks.succeeded'
    )
    expect(taskStatusText(makeTask({ status: 'FAILED' }), false)).toBe(
      'backgroundTasks.failed'
    )
    // CANCELLED терминален: cancelRequested больше не переводит в «отменяется»
    expect(
      taskStatusText(
        makeTask({ status: 'CANCELLED', cancelRequested: true }),
        false
      )
    ).toBe('backgroundTasks.cancelled')
  })
})
