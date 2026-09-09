import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Autocomplete, TextField, Typography } from '@mui/material'

import {
  useAiModels,
  type AnalyticsModel,
  type LlmProvider,
} from '@/entities/analytics'
import { Button } from '@/shared/ui/buttons'
import type { TranslationKey } from '@/shared/types/i18n.types'

interface ModelAutocompleteProps {
  provider: LlmProvider
  baseUrl: string
  value: string
  /** Ключ i18n сообщения валидации; пусто — ошибки нет. */
  error?: TranslationKey
  onChange: (model: string) => void
}

/** Цена OpenRouter — USD за миллион токенов: `вход / выход`. */
const formatPricing = (model: AnalyticsModel): string | null => {
  if (!model.pricingPrompt && !model.pricingCompletion) return null
  return `$${model.pricingPrompt ?? '—'} / $${model.pricingCompletion ?? '—'}`
}

/** Идентификатор модели: у `freeSolo` значением может быть и ручной ввод. */
const modelId = (option: AnalyticsModel | string): string =>
  typeof option === 'string' ? option : option.id

/**
 * Выбор модели.
 *
 * `freeSolo` обязателен: провайдеры выпускают модели быстрее, чем обновляется
 * каталог, и идентификатор всегда можно вписать руками. Список подгружается
 * лениво — у OpenRouter это сотни моделей, тянуть их на каждое открытие
 * страницы незачем; ошибка загрузки показывается, но ввод не блокирует.
 */
export const ModelAutocomplete = ({
  provider,
  baseUrl,
  value,
  error,
  onChange,
}: ModelAutocompleteProps) => {
  const { t } = useTranslation()
  const [requested, setRequested] = useState(false)

  const { models, isLoading, isError, refetch } = useAiModels(
    provider,
    baseUrl || undefined,
    requested
  )

  const handleRefresh = () => {
    if (requested) void refetch()
    else setRequested(true)
  }

  const helperText = error
    ? t(error)
    : isLoading
      ? t('analytics.settings.modelsLoading')
      : isError
        ? t('analytics.settings.modelsError')
        : t('analytics.settings.modelHint')

  return (
    <div className="flex items-start gap-2">
      <Autocomplete<AnalyticsModel, false, false, true>
        freeSolo
        fullWidth
        options={models}
        loading={isLoading}
        value={value}
        onOpen={() => {
          setRequested(true)
        }}
        getOptionLabel={modelId}
        isOptionEqualToValue={(option, selected) =>
          modelId(option) === modelId(selected)
        }
        onChange={(_event, next) => {
          onChange(next ? modelId(next) : '')
        }}
        onInputChange={(_event, next) => {
          onChange(next)
        }}
        renderOption={(props, option) => {
          const { key, ...rest } = props
          const pricing = formatPricing(option)
          return (
            <li key={key} {...rest}>
              <div className="flex flex-col">
                <Typography variant="body2">{option.name}</Typography>
                <Typography
                  variant="caption"
                  className="tabular-nums text-ui-05"
                >
                  {pricing ? `${option.id} · ${pricing}` : option.id}
                </Typography>
              </div>
            </li>
          )
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={t('analytics.settings.model')}
            error={!!error}
            helperText={helperText}
          />
        )}
      />
      {/* Каталог подтягивается сам при открытии списка, кнопка нужна только
          для повторной загрузки — поэтому текстовая, а не заметная. */}
      <Button
        variant="tertiary"
        size="small"
        className="mt-2.5 shrink-0"
        disabled={isLoading}
        onClick={handleRefresh}
      >
        {t('analytics.settings.loadModels')}
      </Button>
    </div>
  )
}
