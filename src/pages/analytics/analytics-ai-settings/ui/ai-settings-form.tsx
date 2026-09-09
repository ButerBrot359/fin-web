import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { TextField, Typography } from '@mui/material'

import type { AnalyticsAiSettings } from '@/entities/analytics'
import type { TranslationKey } from '@/shared/types/i18n.types'

import { useAiSettingsForm } from '../lib/hooks/use-ai-settings-form'
import { AiContextNotice } from './ai-context-notice'
import { AiSettingsActions } from './ai-settings-actions'
import { ApiKeyField } from './api-key-field'
import { GenerationParamsFields } from './generation-params-fields'
import { ModelAutocomplete } from './model-autocomplete'
import { ProviderSelector } from './provider-selector'
import { SettingsSection } from './settings-section'

interface AiSettingsFormProps {
  settings: AnalyticsAiSettings | null
}

/**
 * Форма настроек ИИ-ассистента аналитики.
 *
 * Одна панель, разделённая на группы: «провайдер и модель», «доступ»,
 * «параметры генерации». Группы отбиты волосяной линией, а не вложенными
 * карточками, — вложенная карточка читалась бы как отдельный объект.
 *
 * Смена провайдера очищает модель: идентификаторы у провайдеров свои, и
 * сохранённая модель Claude в OpenAI не существует — тихо оставленное значение
 * дало бы ошибку только при первой попытке что-то построить.
 */
export const AiSettingsForm = ({ settings }: AiSettingsFormProps) => {
  const { t } = useTranslation()
  const { form, submit, test, isSaving, isTesting } =
    useAiSettingsForm(settings)
  const { control, setValue, watch, formState } = form

  const provider = watch('provider')
  const baseUrl = watch('baseUrl')
  // Своя модель: адрес обязателен, ключ — наоборот, обычно не нужен.
  const isLocal = provider === 'LOCAL'

  return (
    <div className="flex flex-col gap-5 rounded-lg bg-ui-01 p-5">
      <AiContextNotice />

      {settings?.inheritedFromSystem && (
        <div className="rounded-md bg-ui-02 px-3 py-2">
          <Typography variant="body2">
            {t('analytics.settings.inherited')}
          </Typography>
        </div>
      )}

      <SettingsSection
        label={`${t('analytics.settings.provider')} · ${t('analytics.settings.model')}`}
      >
        <Controller
          name="provider"
          control={control}
          render={({ field }) => (
            <ProviderSelector
              value={field.value}
              onChange={(next) => {
                field.onChange(next)
                setValue('model', '', { shouldDirty: true })
              }}
            />
          )}
        />

        <Controller
          name="model"
          control={control}
          render={({ field, fieldState }) => (
            <ModelAutocomplete
              provider={provider}
              baseUrl={baseUrl}
              value={field.value}
              // Сообщения схемы — ключи i18n (см. ai-settings-schema.ts), но
              // react-hook-form типизирует message как обычную строку.
              error={fieldState.error?.message as TranslationKey | undefined}
              onChange={field.onChange}
            />
          )}
        />
      </SettingsSection>

      <SettingsSection
        divided
        label={`${t('analytics.settings.baseUrl')} · ${t('analytics.settings.apiKey')}`}
      >
        <Controller
          name="baseUrl"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              required={isLocal}
              label={t('analytics.settings.baseUrl')}
              error={!!fieldState.error}
              helperText={t(
                (fieldState.error?.message as TranslationKey | undefined) ??
                  (isLocal
                    ? 'analytics.settings.baseUrlHintLocal'
                    : 'analytics.settings.baseUrlHint')
              )}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          name="apiKey"
          control={control}
          render={({ field }) => (
            <ApiKeyField
              value={field.value}
              savedMask={settings?.apiKeyMask}
              hasSavedKey={settings?.hasApiKey ?? false}
              optional={isLocal}
              onChange={field.onChange}
            />
          )}
        />
      </SettingsSection>

      <SettingsSection divided label={t('analytics.params.title')}>
        <GenerationParamsFields control={control} />
      </SettingsSection>

      <AiSettingsActions
        isSaving={isSaving}
        isTesting={isTesting}
        isDirty={formState.isDirty}
        onSave={submit}
        onTest={test}
      />
    </div>
  )
}
