import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Typography } from '@mui/material'

import type { AiAssistantCreatedDocument } from '@/entities/ai-assistant'
import {
  fetchTask,
  isTerminalTaskStatus,
  type AsyncTaskStatus,
} from '@/entities/async-task'
import { invalidateDocumentQueries } from '@/shared/lib/query/invalidate-entities'
import { requestOpenViewsRefresh } from '@/shared/lib/refresh/open-views-refresh'
import { showToast } from '@/shared/ui/toast/show-toast'
import { Button } from '@/shared/ui/buttons'
import type { TranslationKey } from '@/shared/types/i18n.types'

const STATUS_KEYS: Record<AsyncTaskStatus, TranslationKey> = {
  QUEUED: 'aiAssistant.postingQueued',
  RUNNING: 'aiAssistant.postingRunning',
  SUCCEEDED: 'aiAssistant.postingSucceeded',
  FAILED: 'aiAssistant.postingFailed',
  CANCELLED: 'aiAssistant.postingCancelled',
}

/** Статус фоновой операции одинаково обновляется в панели и в истории чата. */
export const AssistantPostingStatus = ({
  document,
}: {
  document: AiAssistantCreatedDocument
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const refreshedTask = useRef<string | null>(null)
  const task = useQuery({
    queryKey: ['ai-assistant', 'posting-task', document.taskId],
    queryFn: () => fetchTask(document.taskId!),
    enabled: !!document.taskId,
    retry: false,
    refetchInterval: (query) =>
      query.state.status === 'error' ||
      (query.state.data && isTerminalTaskStatus(query.state.data.status))
        ? false
        : 2500,
    staleTime: 2500,
  })
  const status = task.data?.status ?? document.taskStatus ?? 'QUEUED'
  const error = task.data?.errorMessage ?? document.taskError

  useEffect(() => {
    if (
      !task.data ||
      !isTerminalTaskStatus(task.data.status) ||
      refreshedTask.current === task.data.id
    )
      return
    refreshedTask.current = task.data.id
    invalidateDocumentQueries(queryClient)
    for (const key of [
      'sdui-list',
      'document-movements',
      'sdui-report-result',
    ]) {
      void queryClient.invalidateQueries({ queryKey: [key] })
    }
    void requestOpenViewsRefresh().then((result) => {
      if (result.deferred > 0)
        showToast('warning', t('aiAssistant.refreshDeferred'))
      if (result.failed > 0) showToast('error', t('aiAssistant.refreshFailed'))
    })
  }, [task.data, queryClient, t])

  return (
    <div role="status" className="flex min-w-0 flex-col">
      <Typography variant="caption" className="text-ui-05">
        {t(STATUS_KEYS[status])}
      </Typography>
      {error && (
        <Typography variant="caption" className="break-words text-support-01">
          {error}
        </Typography>
      )}
      {(task.isError || !document.taskId) && (
        <Typography variant="caption" className="text-support-01">
          {t('aiAssistant.postingStatusUnavailable')}
        </Typography>
      )}
      {task.isError && (
        <Button
          size="small"
          variant="tertiary"
          onClick={() => {
            void task.refetch()
          }}
        >
          {t('aiAssistant.postingRetry')}
        </Button>
      )}
    </div>
  )
}
