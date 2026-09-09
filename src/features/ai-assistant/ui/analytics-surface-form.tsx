import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox, FormControlLabel, Typography } from '@mui/material'

import {
  useAiSettings,
  useUpdateAiSettings,
  type AnalyticsAiSettings,
} from '@/entities/analytics'
import { Button } from '@/shared/ui/buttons'
import { showToast } from '@/shared/ui/toast/show-toast'

import { ConnectionSelect } from './connection-select'

/**
 * Контур «Аналитика»: какое подключение использует ассистент отчётов и дашбордов.
 *
 * <p>Провайдера и ключа здесь нет — они в реестре подключений. Контур хранит только
 * ссылку и признак включённости.
 */
export const AnalyticsSurfaceForm = () => {
  const { t } = useTranslation()
  const { settings } = useAiSettings()
  const update = useUpdateAiSettings()
  const [connectionId, setConnectionId] = useState<number | null>(null)
  const [enabled, setEnabled] = useState(true)
  const [synced, setSynced] = useState<AnalyticsAiSettings | null>(null)

  // Синхронизация в рендере, а не в эффекте: так требует линтер проекта.
  if (settings && settings !== synced) {
    setSynced(settings)
    setConnectionId(settings.connectionId ?? null)
    setEnabled(settings.enabled)
  }

  const submit = () => {
    if (!settings) return
    update.mutate(
      {
        connectionId,
        provider: settings.provider,
        model: settings.model,
        baseUrl: settings.baseUrl ?? null,
        apiKey: null,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        enabled,
      },
      {
        onSuccess: () => {
          showToast('success', t('analytics.settings.saved'))
        },
        onError: () => {
          showToast('error', t('errors.somethingWentWrong'))
        },
      }
    )
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-ui-01 p-5">
      <div className="flex flex-col gap-1">
        <Typography variant="subtitle2">
          {t('aiAssistant.disclosureAnalytics')}
        </Typography>
        <Typography variant="body2" className="text-ui-05">
          {t('analytics.settings.subtitle')}
        </Typography>
      </div>

      <ConnectionSelect value={connectionId} onChange={setConnectionId} />

      <FormControlLabel
        control={
          <Checkbox
            checked={enabled}
            onChange={(event) => {
              setEnabled(event.target.checked)
            }}
          />
        }
        label={t('analytics.settings.enabled')}
      />

      <div className="flex justify-end">
        <Button variant="primary" disabled={update.isPending} onClick={submit}>
          {t('analytics.settings.save')}
        </Button>
      </div>
    </div>
  )
}
