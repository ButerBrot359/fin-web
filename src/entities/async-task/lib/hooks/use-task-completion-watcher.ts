import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchTask } from '../../api/tasks-api'
import type { AsyncTask } from '../../types/async-task'
import { isTerminalTaskStatus } from '../task-status'

// Тот же темп, что у SDUI-вотчера (use-task-watcher.ts)
export const TASK_COMPLETION_POLL_INTERVAL_MS = 2500

// apiService на 4xx бросает тело ответа ({status, error, message}), не AxiosError
function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { status?: unknown }).status === 404
  )
}

/**
 * Генерик-вотчер фоновых задач ВНЕ SDUI (SCRUM-330): следит за набором task id,
 * поллит `GET /api/tasks/{id}` раз в 2.5 с и по терминальному статусу дёргает
 * `onSettled`, после чего снимает задачу с опроса. Никакого рапорта
 * `task.finished` (это протокол SDUI-форм) и никакой привязки к formSessionId —
 * состояние своё, лёгкое, живёт внутри хука; SDUI-стор не затрагивается.
 *
 * Снятые с опроса по 404 задачи (пропала/чужая) колбэк НЕ получают — показать
 * итог нечем; результат останется виден в панели «Мои операции».
 * Вотчер живёт, пока смонтирован компонент-хозяин (тулбар/страница списка) —
 * при уходе со страницы итоговый тост не показывается, как и в SDUI.
 */
export function useTaskCompletionWatcher(
  onSettled: (task: AsyncTask) => void
): { watch: (task: AsyncTask) => void } {
  const [ids, setIds] = useState<readonly string[]>([])

  // Колбэк — через ref: его пересоздание на каждый рендер (замыкание на t,
  // queryClient) не должно перезапускать интервал опроса.
  const onSettledRef = useRef(onSettled)
  useEffect(() => {
    onSettledRef.current = onSettled
  }, [onSettled])

  const watch = useCallback((task: AsyncTask) => {
    // Уже терминальная (гонка с быстрым завершением) — итог сразу, без опроса
    if (isTerminalTaskStatus(task.status)) {
      onSettledRef.current(task)
      return
    }
    setIds((prev) => (prev.includes(task.id) ? prev : [...prev, task.id]))
  }, [])

  useEffect(() => {
    if (ids.length === 0) return

    // Защита от наложения запросов при медленной сети (тик каждые 2.5 с)
    const inFlight = new Set<string>()

    const settle = (id: string, task?: AsyncTask) => {
      setIds((prev) => prev.filter((watched) => watched !== id))
      if (task) onSettledRef.current(task)
    }

    const tick = () => {
      for (const id of ids) {
        if (inFlight.has(id)) continue
        inFlight.add(id)
        fetchTask(id)
          .then((task) => {
            if (isTerminalTaskStatus(task.status)) settle(id, task)
          })
          .catch((err: unknown) => {
            if (isNotFoundError(err)) settle(id)
            // Прочие ошибки (сеть) — молча ждём следующего тика
          })
          .finally(() => {
            inFlight.delete(id)
          })
      }
    }

    const interval = setInterval(tick, TASK_COMPLETION_POLL_INTERVAL_MS)
    return () => {
      clearInterval(interval)
    }
  }, [ids])

  return { watch }
}
