import { LinearProgress, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import {
  cancelTask,
  isTerminalTaskStatus,
  type AsyncTask,
} from '@/entities/async-task'
import { Button } from '@/shared/ui/buttons'

import { taskStatusText } from '../lib/utils/task-status-text'

interface TaskRowProps {
  task: AsyncTask
}

export const TaskRow = ({ task }: TaskRowProps) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const cancelMutation = useMutation({
    mutationFn: () => cancelTask(task.id),
    onSettled: () => {
      // 202 — отмена лишь ЗАПРОШЕНА («отменяется»), CANCELLED приедет из
      // опроса; 404 — уже завершена/чужая. В обоих случаях просто освежаем список.
      void queryClient.invalidateQueries({ queryKey: ['background-tasks'] })
    },
  })

  const active = !isTerminalTaskStatus(task.status)
  const cancelPending = cancelMutation.isPending || cancelMutation.isSuccess
  const cancelling = cancelPending || task.cancelRequested === true

  return (
    <div className="border-t border-ui-04 py-2 first:border-t-0">
      <Typography variant="body2">{task.title}</Typography>
      {active && (
        <LinearProgress
          className="my-1"
          variant={
            // progressTotal неизвестен → неопределённый индикатор, не «0 %»
            task.progressPercent == null ? 'indeterminate' : 'determinate'
          }
          value={task.progressPercent ?? undefined}
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <Typography variant="caption" className="text-ui-03">
          {taskStatusText(task, cancelPending)}
        </Typography>
        {active && !cancelling && (
          <Button
            variant="tertiary"
            onClick={() => {
              cancelMutation.mutate()
            }}
          >
            {t('backgroundTasks.cancel')}
          </Button>
        )}
      </div>
      {task.status === 'FAILED' && task.errorMessage && (
        <Typography variant="caption" className="text-red-600">
          {task.errorMessage}
        </Typography>
      )}
    </div>
  )
}
