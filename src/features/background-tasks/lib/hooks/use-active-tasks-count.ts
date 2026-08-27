import { useQuery } from '@tanstack/react-query'

import {
  fetchActiveTasks,
  isActiveTask,
  useAsyncTaskStore,
} from '@/entities/async-task'

export const ACTIVE_TASKS_POLL_MS = 10_000

// Бейдж «работает N операций» (handoff §3.3): неспешный опрос
// /api/tasks/active + задачи, запущенные из этой вкладки (стор эффекта
// taskStarted), — вторые видны мгновенно, не дожидаясь первого опроса.
export function useActiveTasksCount(): number {
  const { data } = useQuery({
    queryKey: ['background-tasks', 'active'],
    queryFn: fetchActiveTasks,
    refetchInterval: ACTIVE_TASKS_POLL_MS,
  })
  const entries = useAsyncTaskStore((s) => s.entries)

  const ids = new Set((data ?? []).filter(isActiveTask).map((t) => t.id))
  for (const entry of Object.values(entries)) {
    if (isActiveTask(entry.task)) ids.add(entry.task.id)
  }
  return ids.size
}
