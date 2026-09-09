import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import {
  useAiConnections,
  useCreateAiConnection,
  useDeleteAiConnection,
  useTestAiConnection,
  useUpdateAiConnection,
  type AiConnection,
  type AiConnectionUpdate,
} from '@/entities/ai-connection'
import { Button } from '@/shared/ui/buttons'
import { showToast } from '@/shared/ui/toast/show-toast'

import { ConnectionFormDialog } from './connection-form-dialog'

/**
 * Реестр подключений к ИИ.
 *
 * <p>Отдельный блок над настройками контуров: провайдер, ключ и модель описываются
 * здесь один раз, а «Аналитика» и «Помощник» ниже только выбирают из готовых. Так три
 * модели одного OpenRouter живут одновременно, а ключ заводится единожды.
 */
export const AiConnectionsPanel = () => {
  const { t } = useTranslation()
  const { connections, isLoading } = useAiConnections()
  const create = useCreateAiConnection()
  const update = useUpdateAiConnection()
  const remove = useDeleteAiConnection()
  const test = useTestAiConnection()

  const [editing, setEditing] = useState<AiConnection | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const submit = (request: AiConnectionUpdate) => {
    const onSuccess = () => {
      setDialogOpen(false)
      showToast('success', t('analytics.settings.saved'))
    }
    const onError = () => {
      showToast('error', t('errors.somethingWentWrong'))
    }
    if (editing) {
      update.mutate({ id: editing.id, request }, { onSuccess, onError })
    } else {
      create.mutate(request, { onSuccess, onError })
    }
  }

  const runTest = (connection: AiConnection) => {
    test.mutate(connection.id, {
      onSuccess: (result) => {
        showToast(
          result.success ? 'success' : 'error',
          result.success
            ? t('analytics.settings.testOk')
            : t('analytics.settings.testFail'),
          result.message ?? undefined
        )
      },
      onError: () => {
        showToast('error', t('analytics.settings.testFail'))
      },
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-ui-01 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Typography variant="subtitle2">
            {t('aiConnections.title')}
          </Typography>
          <Typography variant="body2" className="text-ui-05">
            {t('aiConnections.subtitle')}
          </Typography>
        </div>
        <Button
          variant="primary"
          size="small"
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          {t('aiConnections.add')}
        </Button>
      </div>

      {!isLoading && connections.length === 0 && (
        <Typography variant="body2" className="text-ui-05">
          {t('aiConnections.empty')}
        </Typography>
      )}

      <div className="flex flex-col gap-2">
        {connections.map((connection) => (
          <div
            key={connection.id}
            className="flex flex-wrap items-center gap-3 rounded-md bg-ui-02 px-3 py-2"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <Typography variant="body2" fontWeight={600}>
                {connection.name}
              </Typography>
              <Typography variant="caption" className="text-ui-05">
                {`${connection.provider} · ${connection.model}${
                  connection.apiKeyMask ? ` · ${connection.apiKeyMask}` : ''
                }`}
              </Typography>
            </div>

            {/* Красным помечено то, что необратимо: данные уходят наружу. */}
            {connection.external && (
              <Typography variant="caption" className="text-support-01">
                {t('aiAssistant.disclosureExternal')}
              </Typography>
            )}

            <Button
              variant="tertiary"
              size="small"
              disabled={test.isPending}
              onClick={() => {
                runTest(connection)
              }}
            >
              {t('analytics.settings.test')}
            </Button>
            <Button
              variant="tertiary"
              size="small"
              onClick={() => {
                setEditing(connection)
                setDialogOpen(true)
              }}
            >
              {t('actions.edit')}
            </Button>
            <Button
              variant="tertiary"
              size="small"
              disabled={remove.isPending}
              onClick={() => {
                remove.mutate(connection.id, {
                  onError: () => {
                    showToast('error', t('errors.somethingWentWrong'))
                  },
                })
              }}
            >
              {t('actions.delete')}
            </Button>
          </div>
        ))}
      </div>

      <ConnectionFormDialog
        open={dialogOpen}
        connection={editing}
        isSaving={create.isPending || update.isPending}
        onClose={() => {
          setDialogOpen(false)
        }}
        onSubmit={submit}
      />
    </div>
  )
}
