import i18n from 'i18next'

import type { AsyncTask } from '@/entities/async-task'

// Ниже этого порога линейная экстраполяция врёт слишком сильно — не показываем
const MIN_PERCENT_FOR_ESTIMATE = 5
// < 90 сек — секунды; < 90 мин — минуты; дальше — часы+минуты
const SECONDS_CAP_MS = 90_000
const MINUTES_CAP_MS = 90 * 60_000

/**
 * Оценка «сколько осталось» для RUNNING-задачи: линейная экстраполяция
 * elapsed * (100 − percent) / percent от `startedAt`. Тикает вместе с поллингом
 * панели (компонент ререндерится каждым опросом) — отдельный таймер не нужен.
 *
 * @returns null, когда оценки нет: не RUNNING, percent < 5 или неизвестен,
 * нет/битый startedAt — индикатор остаётся без строки остатка.
 */
export function taskRemainingText(
  task: AsyncTask,
  nowMs: number
): string | null {
  if (task.status !== 'RUNNING') return null

  const percent = task.progressPercent
  if (percent == null || percent < MIN_PERCENT_FOR_ESTIMATE || percent >= 100) {
    return null
  }

  if (!task.startedAt) return null
  const startedMs = Date.parse(task.startedAt)
  if (Number.isNaN(startedMs)) return null

  const elapsedMs = nowMs - startedMs
  if (elapsedMs <= 0) return null

  const remainingMs = (elapsedMs * (100 - percent)) / percent

  // Имя параметра value (не count) — намеренно: плюральные суффиксы i18next не нужны
  if (remainingMs < SECONDS_CAP_MS) {
    return i18n.t('backgroundTasks.remainingSeconds', {
      value: Math.max(1, Math.round(remainingMs / 1000)),
    })
  }
  if (remainingMs < MINUTES_CAP_MS) {
    return i18n.t('backgroundTasks.remainingMinutes', {
      value: Math.round(remainingMs / 60_000),
    })
  }
  const totalMinutes = Math.round(remainingMs / 60_000)
  return i18n.t('backgroundTasks.remainingHoursMinutes', {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  })
}
