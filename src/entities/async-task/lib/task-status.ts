import type { AsyncTask, AsyncTaskStatus } from '../types/async-task'

// SUCCEEDED/FAILED/CANCELLED — окончательные статусы (handoff §3.2)
const TERMINAL_STATUSES: ReadonlySet<AsyncTaskStatus> = new Set([
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
])

export function isTerminalTaskStatus(status: AsyncTaskStatus): boolean {
  return TERMINAL_STATUSES.has(status)
}

export function isActiveTask(task: AsyncTask): boolean {
  return !isTerminalTaskStatus(task.status)
}
