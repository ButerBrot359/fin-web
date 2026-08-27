import { useEffect } from 'react'

import {
  fetchTask,
  isTerminalTaskStatus,
  useAsyncTaskStore,
} from '@/entities/async-task'

import { useSduiDispatch } from '../dispatch'

export const TASK_POLL_INTERVAL_MS = 2500

function isNotFoundError(err: unknown): boolean {
  // apiService на 4xx бросает тело ответа ({status, error, message}), не AxiosError
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { status?: unknown }).status === 404
  )
}

// SCRUM-330 §3.3–3.4: вотчер фоновых задач формы. Поллит задачи СВОЕЙ сессии
// раз в 2.5 с; по терминальному статусу шлёт COMMAND task.finished:<id> — БЕЗ
// статуса: сервер сверяет его по реестру сам (клиент штатно отстаёт на интервал
// опроса) и отвечает точечными патчами (кнопки, признак проведения) и
// уведомлением. 404 на опросе (задача пропала/чужая) — тоже рапортуем: сервер
// ответит «операция не найдена» и вернёт кнопки, форма не останется
// заблокированной навсегда.
export function useTaskWatcher(formSessionId: string | null): void {
  const dispatch = useSduiDispatch()
  const entries = useAsyncTaskStore((s) => s.entries)

  const watchedIds = Object.values(entries)
    .filter((e) => e.formSessionId === formSessionId && !e.finishing)
    .map((e) => e.task.id)
  const watchedKey = watchedIds.join(',')

  useEffect(() => {
    if (!formSessionId || watchedKey === '') return

    const finishTask = async (taskId: string) => {
      const store = useAsyncTaskStore.getState()
      store.markFinishing(taskId, true)
      const ok = await dispatch({
        type: 'COMMAND',
        command: `task.finished:${taskId}`,
      })
      // Неуспех (сеть, in-flight-гард пользовательской команды) — вернуть под
      // опрос: следующий тик увидит тот же терминальный статус и повторит рапорт
      if (ok) store.untrack(taskId)
      else store.markFinishing(taskId, false)
    }

    const tick = () => {
      const store = useAsyncTaskStore.getState()
      for (const id of watchedKey.split(',')) {
        // Задача могла быть снята между тиками (unmount/рапорт другого тика)
        if (!(id in store.entries)) continue
        const entry = store.entries[id]
        if (entry.finishing) continue
        fetchTask(id)
          .then((task) => {
            store.updateTask(task)
            if (isTerminalTaskStatus(task.status)) void finishTask(id)
          })
          .catch((err: unknown) => {
            if (isNotFoundError(err)) void finishTask(id)
            // Прочие ошибки (сеть) — молча ждём следующего тика
          })
      }
    }

    const interval = setInterval(tick, TASK_POLL_INTERVAL_MS)
    return () => {
      clearInterval(interval)
    }
  }, [formSessionId, watchedKey, dispatch])

  // Сессия закрылась/сменилась — команду слать некуда (v2 §3.4): снимаем её
  // задачи с поллинга; результат останется виден в панели «Мои операции».
  useEffect(() => {
    if (!formSessionId) return
    return () => {
      useAsyncTaskStore.getState().untrackSession(formSessionId)
    }
  }, [formSessionId])
}
