import i18n from 'i18next'

import { isTerminalTaskStatus, type AsyncTask } from '@/entities/async-task'

// Строка статуса под названием задачи. «Отменяется» — НЕ «отменено»: отмена
// кооперативная, после 202 задача останавливается в ближайшей безопасной
// точке; CANCELLED приходит только из опроса (handoff §3.3).
export function taskStatusText(
  task: AsyncTask,
  cancelPending: boolean
): string {
  const cancelling =
    cancelPending ||
    (task.cancelRequested === true && !isTerminalTaskStatus(task.status))
  if (cancelling) return i18n.t('backgroundTasks.cancelling')

  switch (task.status) {
    case 'QUEUED':
      return i18n.t('backgroundTasks.queued')
    case 'RUNNING': {
      const base = task.progressMessage ?? i18n.t('backgroundTasks.running')
      // При progressTotal null процент тоже null — никакого «0 %» (handoff §3.2)
      return task.progressPercent != null
        ? `${base} — ${String(task.progressPercent)}%`
        : base
    }
    case 'SUCCEEDED':
      return i18n.t('backgroundTasks.succeeded')
    case 'FAILED':
      return i18n.t('backgroundTasks.failed')
    case 'CANCELLED':
      return i18n.t('backgroundTasks.cancelled')
  }
}
