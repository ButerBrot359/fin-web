import { CircularProgress, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { fetchTasks } from '@/entities/async-task'

import { TaskRow } from './task-row'

export const TASKS_LIST_POLL_MS = 3000

// Содержимое поповера «Мои операции»: активные и недавно завершённые задачи
// пользователя, свежие сверху (handoff §3.3). Поллинг живёт, пока поповер
// открыт (компонент размонтируется вместе с ним).
interface BackgroundTasksPanelProps {
  /** Вызывается после перехода к объекту задачи — чтобы закрыть поповер. */
  onNavigate?: () => void
}

export const BackgroundTasksPanel = ({
  onNavigate,
}: BackgroundTasksPanelProps) => {
  const { t } = useTranslation()
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['background-tasks', 'list'],
    queryFn: fetchTasks,
    refetchInterval: TASKS_LIST_POLL_MS,
  })

  return (
    <div className="max-h-96 w-96 overflow-auto p-3">
      <Typography variant="subtitle2" className="pb-1">
        {t('backgroundTasks.title')}
      </Typography>
      {isLoading && (
        <div className="flex justify-center py-4">
          <CircularProgress size={20} />
        </div>
      )}
      {!isLoading && (data?.length ?? 0) === 0 && (
        <Typography variant="body2" className="py-2 text-ui-03">
          {t('backgroundTasks.empty')}
        </Typography>
      )}
      {/* dataUpdatedAt — «часы» оценки остатка: тикают с каждым опросом */}
      {data?.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          now={dataUpdatedAt}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  )
}
