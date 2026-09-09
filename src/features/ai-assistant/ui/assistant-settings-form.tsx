import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox, FormControlLabel, Typography } from '@mui/material'

import { useAiConnections } from '@/entities/ai-connection'
import {
  useAiAssistantSettings,
  useUpdateAiAssistantSettings,
  type AiAssistantSettings,
} from '@/entities/ai-assistant'
import { Button } from '@/shared/ui/buttons'
import { showToast } from '@/shared/ui/toast/show-toast'

import { ConnectionSelect } from './connection-select'

/**
 * Контур «Помощник»: какое подключение использует чат поверх формы.
 *
 * <p>Отдельно от контура аналитики намеренно: у них разный класс отправляемых данных,
 * и одна запись означала бы, что смена модели для отчётов молча меняет адресата сумм
 * и ФИО. Здесь же — красные предупреждения о последствиях выбора: выбор не
 * блокируется, но цена названа.
 */
export const AssistantSettingsForm = () => {
  const { t } = useTranslation()
  const { settings } = useAiAssistantSettings()
  const { connections } = useAiConnections()
  const update = useUpdateAiAssistantSettings()

  const [connectionId, setConnectionId] = useState<number | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [synced, setSynced] = useState<AiAssistantSettings | null>(null)

  if (settings && settings !== synced) {
    setSynced(settings)
    setConnectionId(settings.connectionId ?? null)
    setEnabled(settings.enabled)
    setAcknowledged(settings.externalProviderAcknowledged)
  }

  const selected = connections.find(
    (connection) => connection.id === connectionId
  )
  const isExternal = selected?.external ?? false

  const submit = () => {
    update.mutate(
      {
        connectionId,
        provider: selected?.provider ?? 'LOCAL',
        model: selected?.model ?? '',
        baseUrl: selected?.baseUrl ?? null,
        apiKey: null,
        temperature: selected?.temperature ?? 0.2,
        maxTokens: selected?.maxTokens ?? 4000,
        enabled,
        externalProviderAcknowledged: acknowledged,
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
          {t('aiAssistant.settingsTitle')}
        </Typography>
        <Typography variant="body2" className="text-ui-05">
          {t('aiAssistant.settingsSubtitle')}
        </Typography>
      </div>

      <ConnectionSelect value={connectionId} onChange={setConnectionId} />

      {/* Выбор облачного подключения НЕ блокируется — решение за организацией.
          Но последствия названы красным: сюда уходят суммы, ФИО и ИИН конкретных
          людей, и обратно их не вернуть. Галочка — след решения, не условие. */}
      {isExternal && (
        <div className="flex flex-col gap-2 rounded-r-lg border-l-4 border-support-01 bg-ui-04 px-4 py-3">
          <Typography
            variant="body2"
            fontWeight={700}
            className="text-support-01"
          >
            {t('aiAssistant.externalWarningTitle')}
          </Typography>
          <Typography variant="body2" className="text-support-01">
            {t('aiAssistant.externalWarningBody')}
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={acknowledged}
                onChange={(event) => {
                  setAcknowledged(event.target.checked)
                }}
              />
            }
            label={t('aiAssistant.externalConsent')}
          />
        </div>
      )}

      {/* Возможности — тоже последствие выбора: помощник не только читает. */}
      <div className="flex flex-col gap-1 rounded-r-lg border-l-4 border-support-01 bg-ui-04 px-4 py-3">
        <Typography
          variant="body2"
          fontWeight={700}
          className="text-support-01"
        >
          {t('aiAssistant.powersTitle')}
        </Typography>
        <Typography variant="body2" className="text-support-01">
          {t('aiAssistant.powersCreate')}
        </Typography>
        <Typography variant="body2" className="text-ui-06">
          {t('aiAssistant.powersNoPosting')}
        </Typography>
      </div>

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
        <Button
          variant="primary"
          disabled={update.isPending || connectionId == null}
          onClick={submit}
        >
          {t('analytics.settings.save')}
        </Button>
      </div>
    </div>
  )
}
