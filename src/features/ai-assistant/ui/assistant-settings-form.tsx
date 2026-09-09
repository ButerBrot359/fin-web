import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Checkbox,
  FormControlLabel,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'

import type { LlmProvider } from '@/entities/analytics'
import {
  useAiAssistantSettings,
  useUpdateAiAssistantSettings,
  type AiAssistantSettings,
} from '@/entities/ai-assistant'
import { Button } from '@/shared/ui/buttons'
import type { TranslationKey } from '@/shared/types/i18n.types'
import { showToast } from '@/shared/ui/toast/show-toast'

/** Подписи берутся из ключей раздела аналитики: провайдеры у контуров одни и те же. */
const PROVIDERS: { value: LlmProvider; labelKey: TranslationKey }[] = [
  { value: 'LOCAL', labelKey: 'analytics.settings.providerLocal' },
  { value: 'ANTHROPIC', labelKey: 'analytics.settings.providerAnthropic' },
  { value: 'OPENAI', labelKey: 'analytics.settings.providerOpenai' },
  { value: 'OPENROUTER', labelKey: 'analytics.settings.providerOpenrouter' },
]

interface FormState {
  provider: LlmProvider
  model: string
  baseUrl: string
  apiKey: string
  enabled: boolean
  externalProviderAcknowledged: boolean
}

const toFormState = (settings: AiAssistantSettings | null): FormState => ({
  provider: settings?.provider ?? 'LOCAL',
  model: settings?.model ?? '',
  baseUrl: settings?.baseUrl ?? '',
  // Ключ с сервера не приходит никогда — поле всегда стартует пустым.
  apiKey: '',
  enabled: settings?.enabled ?? false,
  externalProviderAcknowledged: settings?.externalProviderAcknowledged ?? false,
})

/**
 * Настройки ИИ-помощника — отдельный блок, а не переключатель внутри настроек
 * аналитики.
 *
 * Разделение здесь несёт смысл: у двух контуров разный класс отправляемых данных,
 * и общая запись означала бы, что смена провайдера для отчётов молча меняет
 * адресата сумм и ФИО.
 *
 * Согласие на стороннего провайдера — не украшение формы. Такой же запрет стоит
 * на сервере, потому что галочку обходит прямой вызов API, а решение об уходе
 * учётных данных за периметр обходить нельзя.
 */
export const AssistantSettingsForm = () => {
  const { t } = useTranslation()
  const { settings } = useAiAssistantSettings()
  const update = useUpdateAiAssistantSettings()
  const [form, setForm] = useState<FormState>(toFormState(null))
  const [synced, setSynced] = useState<AiAssistantSettings | null>(null)

  // Настройки приходят асинхронно; перезаполняем форму В РЕНДЕРЕ, а не в эффекте.
  // Эффект дал бы лишний проход, в котором форма ещё показывает значения по
  // умолчанию поверх уже полученных с сервера, — и линтер проекта его запрещает
  // именно поэтому. Тот же приём, что в use-generation-stage.
  if (settings && settings !== synced) {
    setSynced(settings)
    setForm(toFormState(settings))
  }

  const isLocal = form.provider === 'LOCAL'
  const needsConsent = !isLocal && !form.externalProviderAcknowledged
  const baseUrlMissing = isLocal && form.baseUrl.trim() === ''

  const patch = (next: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...next }))
  }

  const submit = () => {
    update.mutate(
      {
        provider: form.provider,
        model: form.model.trim(),
        baseUrl: form.baseUrl.trim() || null,
        apiKey: form.apiKey.trim() || null,
        temperature: settings?.temperature ?? 0.2,
        maxTokens: settings?.maxTokens ?? 4000,
        enabled: form.enabled,
        externalProviderAcknowledged: form.externalProviderAcknowledged,
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

      <TextField
        select
        label={t('analytics.settings.provider')}
        value={form.provider}
        onChange={(event) => {
          // Смена провайдера сбрасывает и модель, и согласие: идентификаторы
          // моделей у провайдеров свои, а согласие даётся на конкретного
          // адресата данных, а не один раз навсегда.
          patch({
            provider: event.target.value as LlmProvider,
            model: '',
            externalProviderAcknowledged: false,
          })
        }}
      >
        {PROVIDERS.map((provider) => (
          <MenuItem key={provider.value} value={provider.value}>
            {t(provider.labelKey)}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        label={t('analytics.settings.model')}
        value={form.model}
        onChange={(event) => {
          patch({ model: event.target.value })
        }}
      />

      <TextField
        required={isLocal}
        error={baseUrlMissing}
        label={t('analytics.settings.baseUrl')}
        helperText={t(
          isLocal
            ? 'analytics.settings.baseUrlHintLocal'
            : 'analytics.settings.baseUrlHint'
        )}
        value={form.baseUrl}
        onChange={(event) => {
          patch({ baseUrl: event.target.value })
        }}
      />

      <TextField
        type="password"
        autoComplete="off"
        label={t('analytics.settings.apiKey')}
        helperText={t(
          isLocal
            ? 'analytics.settings.apiKeyHintLocal'
            : 'analytics.settings.apiKeyHint'
        )}
        value={form.apiKey}
        onChange={(event) => {
          patch({ apiKey: event.target.value })
        }}
      />

      {!isLocal && (
        <div className="flex flex-col gap-1 rounded-r-lg border-l-2 border-support-01 bg-ui-04 px-4 py-3">
          <FormControlLabel
            control={
              <Checkbox
                checked={form.externalProviderAcknowledged}
                onChange={(event) => {
                  patch({ externalProviderAcknowledged: event.target.checked })
                }}
              />
            }
            label={t('aiAssistant.externalConsent')}
          />
          <Typography variant="caption" className="text-ui-06">
            {t('aiAssistant.externalConsentHint')}
          </Typography>
        </div>
      )}

      <FormControlLabel
        control={
          <Checkbox
            checked={form.enabled}
            onChange={(event) => {
              patch({ enabled: event.target.checked })
            }}
          />
        }
        label={t('analytics.settings.enabled')}
      />

      <div className="flex justify-end">
        <Button
          variant="primary"
          disabled={
            update.isPending ||
            needsConsent ||
            baseUrlMissing ||
            form.model.trim() === ''
          }
          onClick={submit}
        >
          {t('analytics.settings.save')}
        </Button>
      </div>
    </div>
  )
}
