import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'

import {
  useTestAiSettings,
  useUpdateAiSettings,
  type AnalyticsAiSettings,
} from '@/entities/analytics'
import { showToast } from '@/shared/ui/toast/show-toast'

import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_PROVIDER,
  DEFAULT_TEMPERATURE,
} from '../consts/providers'
import {
  aiSettingsSchema,
  type AiSettingsFormValues,
} from '../utils/ai-settings-schema'

const toFormValues = (
  settings: AnalyticsAiSettings | null
): AiSettingsFormValues => ({
  provider: settings?.provider ?? DEFAULT_PROVIDER,
  model: settings?.model ?? '',
  baseUrl: settings?.baseUrl ?? '',
  // Ключ с сервера не приходит никогда — поле всегда стартует пустым.
  apiKey: '',
  temperature: settings?.temperature ?? DEFAULT_TEMPERATURE,
  maxTokens: settings?.maxTokens ?? DEFAULT_MAX_TOKENS,
  enabled: settings?.enabled ?? true,
})

/**
 * Форма настроек ИИ: значения, сохранение и проверка подключения.
 *
 * Пустое поле ключа означает «оставить сохранённый» — отправляем `null`, а не
 * пустую строку, иначе бэкенд затрёт рабочий ключ. После успешного сохранения
 * форма перезаполняется ответом сервера (обновляются маска ключа и признак
 * `inheritedFromSystem`), а поле ключа снова становится пустым.
 */
export const useAiSettingsForm = (settings: AnalyticsAiSettings | null) => {
  const { t } = useTranslation()
  const updateMutation = useUpdateAiSettings()
  const testMutation = useTestAiSettings()

  const form = useForm<AiSettingsFormValues>({
    resolver: zodResolver(aiSettingsSchema),
    defaultValues: toFormValues(settings),
  })

  const { reset } = form

  // Настройки приходят асинхронно — перезаполняем форму, пока её не трогали.
  useEffect(() => {
    if (settings) reset(toFormValues(settings))
  }, [settings, reset])

  const submitHandler = form.handleSubmit((values) => {
    updateMutation.mutate(
      {
        provider: values.provider,
        model: values.model.trim(),
        baseUrl: values.baseUrl.trim() || null,
        apiKey: values.apiKey.trim() || null,
        temperature: values.temperature,
        maxTokens: values.maxTokens,
        enabled: values.enabled,
      },
      {
        onSuccess: (saved) => {
          reset(toFormValues(saved))
          showToast('success', t('analytics.settings.saved'))
        },
        onError: () => {
          showToast('error', t('errors.somethingWentWrong'))
        },
      }
    )
  })

  /**
   * Проверка идёт сохранёнными настройками: сервер обращается к провайдеру
   * своим ключом, а не значениями из полей. Поэтому проверять имеет смысл
   * после сохранения.
   */
  const test = () => {
    testMutation.mutate(undefined, {
      onSuccess: (result) => {
        if (result.success) {
          showToast(
            'success',
            t('analytics.settings.testOk'),
            `${result.provider} · ${result.model} · ${String(result.latencyMs)} ms`
          )
        } else {
          showToast(
            'error',
            t('analytics.settings.testFail'),
            result.message ?? undefined
          )
        }
      },
      onError: () => {
        showToast('error', t('analytics.settings.testFail'))
      },
    })
  }

  return {
    form,
    submit: () => {
      void submitHandler()
    },
    test,
    isSaving: updateMutation.isPending,
    isTesting: testMutation.isPending,
  }
}
