import { create } from 'zustand'

import type { AsyncTask } from '../../types/async-task'

// Задачи, запущенные ИЗ ЭТОЙ вкладки браузера (эффект taskStarted, SCRUM-330):
// вотчер SDUI-формы поллит их и рапортует серверу task.finished, а панель
// «Мои операции» берёт отсюда мгновенный бейдж, не дожидаясь опроса REST.
export interface TrackedTask {
  task: AsyncTask
  // Форм-сессия, породившая задачу: команда task.finished шлётся только в неё
  formSessionId: string
  // Выставлен на время отправки task.finished — защита от повторного рапорта
  finishing?: boolean
}

interface AsyncTaskStoreState {
  entries: Record<string, TrackedTask>
  track: (task: AsyncTask, formSessionId: string) => void
  updateTask: (task: AsyncTask) => void
  markFinishing: (taskId: string, finishing: boolean) => void
  untrack: (taskId: string) => void
  untrackSession: (formSessionId: string) => void
}

export const useAsyncTaskStore = create<AsyncTaskStoreState>((set) => ({
  entries: {},

  track: (task, formSessionId) => {
    set((s) => ({
      entries: { ...s.entries, [task.id]: { task, formSessionId } },
    }))
  },

  updateTask: (task) => {
    set((s) => {
      if (!(task.id in s.entries)) return s
      const entry = s.entries[task.id]
      return { entries: { ...s.entries, [task.id]: { ...entry, task } } }
    })
  },

  markFinishing: (taskId, finishing) => {
    set((s) => {
      if (!(taskId in s.entries)) return s
      const entry = s.entries[taskId]
      return { entries: { ...s.entries, [taskId]: { ...entry, finishing } } }
    })
  },

  untrack: (taskId) => {
    set((s) => ({
      entries: Object.fromEntries(
        Object.entries(s.entries).filter(([id]) => id !== taskId)
      ),
    }))
  },

  untrackSession: (formSessionId) => {
    set((s) => ({
      entries: Object.fromEntries(
        Object.entries(s.entries).filter(
          ([, e]) => e.formSessionId !== formSessionId
        )
      ),
    }))
  },
}))
