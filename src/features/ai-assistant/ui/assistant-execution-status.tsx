import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Typography } from '@mui/material'
import {
  aiAssistantApi,
  type AiAssistantExecution,
  type AiExecutionStatus,
  type AiStepStatus,
} from '@/entities/ai-assistant'
import {
  invalidateDocumentQueries,
  invalidateDictionaryQueries,
} from '@/shared/lib/query/invalidate-entities'
import { requestOpenViewsRefresh } from '@/shared/lib/refresh/open-views-refresh'
import { showToast } from '@/shared/ui/toast/show-toast'
import { Button } from '@/shared/ui/buttons'
import type { TranslationKey } from '@/shared/types/i18n.types'
import {
  READ_CAPABILITIES,
  WRITE_CAPABILITIES,
} from '../lib/consts/capability-catalog'
import { AssistantStepOutput } from './assistant-step-output'

const PLAN_KEYS: Record<AiExecutionStatus, TranslationKey> = {
  NEEDS_INPUT: 'aiAssistant.execution_NEEDS_INPUT',
  RUNNING: 'aiAssistant.execution_RUNNING',
  WAITING_TASK: 'aiAssistant.execution_WAITING_TASK',
  COMPLETED: 'aiAssistant.execution_COMPLETED',
  PARTIAL: 'aiAssistant.execution_PARTIAL',
  FAILED: 'aiAssistant.execution_FAILED',
  INDETERMINATE: 'aiAssistant.execution_INDETERMINATE',
}
const STEP_KEYS: Record<AiStepStatus, TranslationKey> = {
  PENDING: 'aiAssistant.step_PENDING',
  RUNNING: 'aiAssistant.step_RUNNING',
  WAITING_TASK: 'aiAssistant.step_WAITING_TASK',
  SUCCEEDED: 'aiAssistant.step_SUCCEEDED',
  FAILED: 'aiAssistant.step_FAILED',
  SKIPPED: 'aiAssistant.step_SKIPPED',
  INDETERMINATE: 'aiAssistant.step_INDETERMINATE',
}

export function AssistantExecutionStatus({
  execution,
  disabled,
  onOpenDocument,
}: {
  execution: AiAssistantExecution
  disabled: boolean
  onOpenDocument: (typeCode: string, entryId: number) => void
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const key = ['ai-assistant', 'execution', execution.id]
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => aiAssistantApi.getExecution(execution.id, signal),
    initialData: execution,
    initialDataUpdatedAt: 0,
    retry: false,
    refetchInterval: (query) =>
      query.state.status !== 'error' &&
      ['RUNNING', 'WAITING_TASK'].includes(query.state.data?.status ?? '')
        ? 2500
        : false,
  })
  const current = query.data
  const prior = useRef(JSON.stringify(execution))
  const resume = useMutation({
    mutationFn: (retryFailed: boolean) =>
      aiAssistantApi.resumeExecution(execution.id, retryFailed),
    onSuccess: (result) => {
      client.setQueryData(key, result)
    },
    onSettled: () => {
      void query.refetch()
    },
  })
  useEffect(() => {
    const signature = JSON.stringify(current)
    if (signature === prior.current) return
    prior.current = signature
    invalidateDocumentQueries(client)
    invalidateDictionaryQueries(client)
    for (const prefix of [
      'sdui-list',
      'document-movements',
      'sdui-report-result',
    ]) {
      void client.invalidateQueries({ queryKey: [prefix] })
    }
    void requestOpenViewsRefresh().then((result) => {
      if (result.deferred > 0)
        showToast('warning', t('aiAssistant.refreshDeferred'))
      if (result.failed > 0) showToast('error', t('aiAssistant.refreshFailed'))
    })
  }, [current, client, t])
  const uncertain =
    current.status === 'INDETERMINATE' ||
    current.steps.some((step) => step.status === 'INDETERMINATE')
  const canResume =
    !uncertain &&
    current.status !== 'RUNNING' &&
    current.steps.some(
      (step) => step.status === 'PENDING' || step.status === 'WAITING_TASK'
    )
  const canRetry =
    !uncertain &&
    ['PARTIAL', 'FAILED'].includes(current.status) &&
    current.steps.some((step) => step.status === 'FAILED')

  return (
    <section
      className="flex min-w-0 flex-col gap-2 rounded-md border border-ui-03 p-2"
      aria-label={t('aiAssistant.executionTitle')}
    >
      <Typography variant="body2" fontWeight={600}>
        {t(PLAN_KEYS[current.status])}
      </Typography>
      {current.steps.map((step) => {
        const label = [...READ_CAPABILITIES, ...WRITE_CAPABILITIES].find(
          (row) => row.value === step.tool
        )?.labelKey
        return (
          <div
            key={step.id}
            className="flex min-w-0 flex-col gap-1 border-t border-ui-03 pt-2"
          >
            <Typography variant="caption">
              {label ? t(label) : t('aiAssistant.actionFallback')} —{' '}
              {t(STEP_KEYS[step.status])}
            </Typography>
            {step.error && (
              <Typography
                variant="caption"
                className="break-words text-support-01"
              >
                {step.error.message}
              </Typography>
            )}
            {!!step.blockedBy?.length && (
              <Typography variant="caption" className="text-ui-05">
                {t('aiAssistant.executionBlocked', {
                  steps: step.blockedBy
                    .map((id) => {
                      const tool = current.steps.find(
                        (item) => item.id === id
                      )?.tool
                      const label = [
                        ...READ_CAPABILITIES,
                        ...WRITE_CAPABILITIES,
                      ].find((item) => item.value === tool)?.labelKey
                      return label ? t(label) : t('aiAssistant.actionFallback')
                    })
                    .join(', '),
                })}
              </Typography>
            )}
            {step.output && (
              <AssistantStepOutput
                output={step.output}
                onOpenDocument={onOpenDocument}
              />
            )}
          </div>
        )
      })}
      {uncertain && (
        <Typography variant="caption" className="text-support-01">
          {t('aiAssistant.executionUnknownHint')}
        </Typography>
      )}
      {query.isError && (
        <div>
          <Typography variant="caption" className="text-support-01">
            {t('aiAssistant.executionFetchError')}
          </Typography>
          <Button
            size="small"
            variant="tertiary"
            onClick={() => {
              void query.refetch()
            }}
          >
            {t('aiAssistant.postingRetry')}
          </Button>
        </div>
      )}
      {resume.isError && (
        <Typography variant="caption" className="text-support-01">
          {t('aiAssistant.executionResumeError')}
        </Typography>
      )}
      {canResume && (
        <Button
          size="small"
          variant="tertiary"
          disabled={disabled || resume.isPending || query.isError}
          onClick={() => {
            resume.mutate(false)
          }}
        >
          {t('aiAssistant.executionResume')}
        </Button>
      )}
      {canRetry && (
        <Button
          size="small"
          variant="tertiary"
          disabled={disabled || resume.isPending || query.isError}
          onClick={() => {
            resume.mutate(true)
          }}
        >
          {t('aiAssistant.executionRetry')}
        </Button>
      )}
    </section>
  )
}
