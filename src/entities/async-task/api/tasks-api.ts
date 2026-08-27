import { apiService } from '@/shared/api/api'

import type { AsyncTask } from '../types/async-task'

// REST фоновых задач (SCRUM-330, handoff §3.3). Все ответы отфильтрованы по
// текущему пользователю на бэке — чужие задачи не отдаются в принципе.

// Мои задачи: активные и недавно завершённые, свежие сверху
export const fetchTasks = async (): Promise<AsyncTask[]> => {
  const res = await apiService.get<AsyncTask[]>({ url: '/api/tasks' })
  return res.data
}

// Только QUEUED/RUNNING — для индикатора «работает N операций»
export const fetchActiveTasks = async (): Promise<AsyncTask[]> => {
  const res = await apiService.get<AsyncTask[]>({ url: '/api/tasks/active' })
  return res.data
}

// 404 — задача чужая либо не существует
export const fetchTask = async (id: string): Promise<AsyncTask> => {
  const res = await apiService.get<AsyncTask>({ url: `/api/tasks/${id}` })
  return res.data
}

// Отмена кооперативная: 202 — принято, «отменяется»; CANCELLED ждать из
// опроса. 404 — чужая либо уже завершена.
export const cancelTask = async (id: string): Promise<void> => {
  await apiService.post({ url: `/api/tasks/${id}/cancel` })
}
