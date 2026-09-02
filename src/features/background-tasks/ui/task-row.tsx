import { LinearProgress, Link, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router-dom'

import {
  cancelTask,
  isTerminalTaskStatus,
  type AsyncTask,
} from '@/entities/async-task'
import { Button } from '@/shared/ui/buttons'

import { taskRemainingText } from '../lib/utils/task-remaining-text'
import { taskStatusText } from '../lib/utils/task-status-text'

interface TaskRowProps {
  task: AsyncTask
  /** Момент последнего опроса панели (dataUpdatedAt) — «сейчас» для оценки остатка. */
  now: number
  /** Сообщить панели о переходе — она закроет поповер. */
  onNavigate?: () => void
}

/**
 * Ссылка на объект задачи — плоский маршрут карточки документа
 * (`ViewRoutes.documentCard` на бэке), раздел подставит редирект по typeCode.
 *
 * `null`, если у задачи нет объекта (например построение отчёта) или он не документ:
 * у справочников и регистров свои маршруты, и вести туда этим путём нельзя.
 */
function taskTargetRoute(task: AsyncTask): string | null {
  const isDocument =
    task.targetDomainKind == null || task.targetDomainKind === 'DOCUMENT'
  if (!isDocument || !task.targetTypeCode || task.targetEntryId == null) {
    return null
  }
  return `/documents/${task.targetTypeCode}/${String(task.targetEntryId)}`
}

export const TaskRow = ({ task, now, onNavigate }: TaskRowProps) => {
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

  // «Осталось ≈ …» тикает вместе с поллингом панели: `now` — dataUpdatedAt
  // запроса, обновляется каждым опросом — отдельный таймер не нужен. Во время
  // отмены оценку прячем — она уже ничего не обещает.
  const remaining = cancelling ? null : taskRemainingText(task, now)

  // Заголовок — ссылка на сам объект. Без неё панель показывала, ЧТО документ не
  // провёлся, но открыть его, чтобы разобраться, было нельзя: код в заголовке
  // («Регламентная операция ABZ00-00001») приходилось искать руками через список.
  const targetRoute = taskTargetRoute(task)

  return (
    <div className="border-t border-ui-04 py-2 first:border-t-0">
      {targetRoute ? (
        <Link
          component={RouterLink}
          to={targetRoute}
          variant="body2"
          underline="hover"
          onClick={onNavigate}
        >
          {task.title}
        </Link>
      ) : (
        <Typography variant="body2">{task.title}</Typography>
      )}
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
        {/* progressMessage бэка попадает сюда через taskStatusText (RUNNING) */}
        <Typography
          variant="caption"
          className="min-w-0 break-words text-ui-03"
        >
          {taskStatusText(task, cancelPending)}
        </Typography>
        {remaining && (
          <Typography
            variant="caption"
            className="shrink-0 whitespace-nowrap text-ui-03"
          >
            {remaining}
          </Typography>
        )}
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
        // Длинный доменный текст (например, про блокировку) переносится по
        // словам внутри поповера, а не распирает его по горизонтали
        <Typography
          variant="caption"
          className="block whitespace-pre-line break-words text-red-600"
        >
          {task.errorMessage}
        </Typography>
      )}
    </div>
  )
}
