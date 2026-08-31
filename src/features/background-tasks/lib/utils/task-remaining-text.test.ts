import { describe, expect, it, vi } from 'vitest'

import type { AsyncTask } from '@/entities/async-task'

import { taskRemainingText } from './task-remaining-text'

// t() → ключ+параметры: проверяем ветвление и арифметику, не переводы
vi.mock('i18next', () => ({
  default: {
    t: (key: string, params: Record<string, number>) =>
      `${key}:${Object.entries(params)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(',')}`,
  },
}))
// Барель @/entities/async-task тянет tasks-api → apiService → инициализацию
// i18n, несовместимую с моком выше; транспорт здесь не нужен
vi.mock('@/shared/api/api', () => ({ apiService: {} }))

const START = Date.parse('2026-08-31T10:00:00Z')

function makeTask(overrides: Partial<AsyncTask>): AsyncTask {
  return {
    id: 't1',
    kind: 'DOCUMENT_POST',
    title: 'Проведение',
    status: 'RUNNING',
    startedAt: '2026-08-31T10:00:00Z',
    ...overrides,
  }
}

describe('taskRemainingText', () => {
  it('не RUNNING → null', () => {
    expect(taskRemainingText(makeTask({ status: 'QUEUED' }), START)).toBeNull()
    expect(
      taskRemainingText(
        makeTask({ status: 'SUCCEEDED', progressPercent: 50 }),
        START + 60_000
      )
    ).toBeNull()
  })

  it('percent < 5 или null → null (оценка ещё не устоялась)', () => {
    expect(
      taskRemainingText(makeTask({ progressPercent: 4 }), START + 60_000)
    ).toBeNull()
    expect(
      taskRemainingText(makeTask({ progressPercent: null }), START + 60_000)
    ).toBeNull()
  })

  it('нет или битый startedAt → null', () => {
    expect(
      taskRemainingText(
        makeTask({ progressPercent: 50, startedAt: null }),
        START
      )
    ).toBeNull()
    expect(
      taskRemainingText(
        makeTask({ progressPercent: 50, startedAt: 'мусор' }),
        START
      )
    ).toBeNull()
  })

  it('< 90 сек → секунды: 50% за 60 c → осталось 60 c', () => {
    expect(
      taskRemainingText(makeTask({ progressPercent: 50 }), START + 60_000)
    ).toBe('backgroundTasks.remainingSeconds:value=60')
  })

  it('>= 90 сек → минуты: 25% за 60 c → осталось 180 c = 3 мин', () => {
    expect(
      taskRemainingText(makeTask({ progressPercent: 25 }), START + 60_000)
    ).toBe('backgroundTasks.remainingMinutes:value=3')
  })

  it('> 90 мин → часы+минуты: 10% за 20 мин → осталось 180 мин = 3 ч 0 мин', () => {
    expect(
      taskRemainingText(makeTask({ progressPercent: 10 }), START + 20 * 60_000)
    ).toBe('backgroundTasks.remainingHoursMinutes:hours=3,minutes=0')
  })

  it('остаток меньше секунды округляется вверх до 1 сек', () => {
    expect(
      taskRemainingText(makeTask({ progressPercent: 99 }), START + 10_000)
    ).toBe('backgroundTasks.remainingSeconds:value=1')
  })

  it('percent 100 при RUNNING → null (нечего оценивать)', () => {
    expect(
      taskRemainingText(makeTask({ progressPercent: 100 }), START + 60_000)
    ).toBeNull()
  })
})
