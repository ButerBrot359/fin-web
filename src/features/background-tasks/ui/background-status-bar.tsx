import { LinearProgress, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { isActiveTask, useAsyncTaskStore } from '@/entities/async-task'

/**
 * Строка состояния (SCRUM-317 канал №6, 1С «Состояние»): тонкая полоса внизу
 * окна над активными фоновыми операциями ЭТОЙ вкладки браузера. Читает реестр
 * задач эффекта taskStarted — провод не трогается, без задач полосы нет.
 */
export const BackgroundStatusBar = () => {
  const { t } = useTranslation()
  const entries = useAsyncTaskStore((s) => s.entries)
  const active = Object.values(entries)
    .map((e) => e.task)
    .filter(isActiveTask)

  if (active.length === 0) return null
  const task = active[0]
  const label = task.progressMessage || task.title

  return (
    <div
      data-testid="background-status-bar"
      className="flex items-center gap-3 rounded-md bg-ui-01 px-4 py-1.5"
    >
      <Typography variant="body2" className="truncate text-ui-06">
        {label}
      </Typography>
      <div className="min-w-0 flex-1">
        <LinearProgress
          variant={
            task.progressPercent != null ? 'determinate' : 'indeterminate'
          }
          value={task.progressPercent ?? undefined}
        />
      </div>
      {active.length > 1 && (
        <Typography variant="body2" className="shrink-0 text-ui-05">
          {t('backgroundTasks.moreActive', { count: active.length - 1 })}
        </Typography>
      )}
    </div>
  )
}
