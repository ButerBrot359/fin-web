import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material'

import type { LlmProvider } from '@/entities/analytics'
import type { AiConnection, AiConnectionUpdate } from '@/entities/ai-connection'
import type { TranslationKey } from '@/shared/types/i18n.types'
import { Button } from '@/shared/ui/buttons'

import { ApiKeyField } from './api-key-field'
import { ModelAutocomplete } from './model-autocomplete'
import { ProviderSelector } from './provider-selector'
import { ConnectionPricingSection } from './connection-pricing-section'
import {
  pricingDraft,
  pricingRequest,
  validPricing,
} from '../lib/pricing/connection-pricing'

interface ConnectionFormDialogProps {
  open: boolean
  /** Редактируемое подключение; пусто — создаём новое. */
  connection: AiConnection | null
  isSaving: boolean
  onClose: () => void
  onSubmit: (request: AiConnectionUpdate) => void
}

const emptyForm = (connection: AiConnection | null): AiConnectionUpdate => ({
  name: connection?.name ?? '',
  provider: connection?.provider ?? 'LOCAL',
  model: connection?.model ?? '',
  baseUrl: connection?.baseUrl ?? '',
  // Ключ с сервера не приходит никогда — поле всегда стартует пустым.
  apiKey: '',
  temperature: connection?.temperature ?? 0.2,
  maxTokens: connection?.maxTokens ?? 8000,
  cacheEnabled: connection?.cacheEnabled ?? false,
})

/**
 * Пояснение под полем обычным текстом, а НЕ через `helperText`.
 *
 * <p>Тема проекта позиционирует `MuiFormHelperText` абсолютно (`bottom: -18`), то есть
 * резервирует под подпись ровно одну строку. Любая подсказка длиннее одной строки
 * вылезает за неё и наезжает на следующее поле — именно это и происходило с подсказками
 * про адрес API и максимум токенов. Обычный блок под полем занимает столько места,
 * сколько ему нужно.
 */
const FieldHint = ({ textKey }: { textKey: TranslationKey }) => {
  const { t } = useTranslation()

  return (
    <Typography variant="caption" className="-mt-2 block text-ui-05">
      {t(textKey)}
    </Typography>
  )
}

/**
 * Форма подключения к ИИ.
 *
 * <p>Провайдер выбирается карточками, а модель — автокомплитом с каталогом провайдера:
 * оба компонента переехали сюда из прежней формы настроек аналитики, где были написаны и
 * обкатаны.
 */
export const ConnectionFormDialog = ({
  open,
  connection,
  isSaving,
  onClose,
  onSubmit,
}: ConnectionFormDialogProps) => {
  const { t } = useTranslation()
  const [form, setForm] = useState<AiConnectionUpdate>(emptyForm(connection))
  const [prices, setPrices] = useState(() => pricingDraft(connection?.pricing))
  const [syncedId, setSyncedId] = useState<number | null>(
    connection?.id ?? null
  )

  // Перезаполнение в рендере, а не в эффекте: линтер проекта запрещает setState
  // в эффекте, и лишний проход показал бы форму с чужими значениями.
  if ((connection?.id ?? null) !== syncedId) {
    setSyncedId(connection?.id ?? null)
    setForm(emptyForm(connection))
    setPrices(pricingDraft(connection?.pricing))
  }

  const isLocal = form.provider === 'LOCAL'
  const baseUrlMissing = isLocal && (form.baseUrl ?? '').trim() === ''
  const incomplete =
    form.name.trim() === '' || form.model.trim() === '' || baseUrlMissing

  const patch = (next: Partial<AiConnectionUpdate>) => {
    setForm((current) => ({ ...current, ...next }))
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('aiConnections.formTitle')}</DialogTitle>
      <DialogContent>
        <div className="flex flex-col gap-4 pt-2">
          <TextField
            label={t('aiConnections.name')}
            value={form.name}
            onChange={(event) => {
              patch({ name: event.target.value })
            }}
          />
          <FieldHint textKey="aiConnections.nameHint" />

          <ProviderSelector
            value={form.provider}
            onChange={(next: LlmProvider) => {
              // Смена провайдера очищает модель: идентификаторы у провайдеров свои,
              // и модель Claude в OpenAI не существует.
              patch({ provider: next, model: '', cacheEnabled: false })
            }}
          />

          <ModelAutocomplete
            provider={form.provider}
            baseUrl={form.baseUrl ?? ''}
            value={form.model}
            onChange={(model) => {
              patch({ model, cacheEnabled: false })
            }}
          />

          <TextField
            required={isLocal}
            error={baseUrlMissing}
            label={t('analytics.settings.baseUrl')}
            value={form.baseUrl ?? ''}
            // Браузер подставлял сюда ФИО пользователя, приняв поле за имя.
            // `off` Chrome на текстовых полях игнорирует, а НЕИЗВЕСТНЫЙ токен
            // трактует как «автозаполнение выключено» — это работает.
            autoComplete="ai-connection-base-url"
            name="ai-connection-base-url"
            onChange={(event) => {
              patch({ baseUrl: event.target.value })
            }}
          />
          <FieldHint
            textKey={
              isLocal
                ? 'analytics.settings.baseUrlHintLocal'
                : 'analytics.settings.baseUrlHint'
            }
          />

          <ApiKeyField
            value={form.apiKey ?? ''}
            savedMask={connection?.apiKeyMask}
            hasSavedKey={connection?.hasApiKey ?? false}
            optional={isLocal}
            onChange={(apiKey) => {
              patch({ apiKey })
            }}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              type="number"
              label={t('analytics.settings.temperature')}
              value={form.temperature}
              onChange={(event) => {
                patch({ temperature: Number(event.target.value) })
              }}
            />
            <TextField
              type="number"
              label={t('analytics.settings.maxTokens')}
              value={form.maxTokens}
              onChange={(event) => {
                patch({ maxTokens: Number(event.target.value) })
              }}
            />
          </div>
          <FieldHint textKey="aiConnections.maxTokensHint" />

          <ConnectionPricingSection
            draft={prices}
            onChange={setPrices}
            provider={form.provider}
            model={form.model}
            cacheEnabled={form.cacheEnabled ?? false}
            onCacheChange={(cacheEnabled) => {
              patch({ cacheEnabled })
            }}
          />

          {!isLocal && (
            <Typography variant="body2" className="text-support-01">
              {t('aiAssistant.externalWarningBody')}
            </Typography>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="tertiary" onClick={onClose}>
          {t('actions.cancel')}
        </Button>
        <Button
          variant="primary"
          disabled={isSaving || incomplete || !validPricing(prices)}
          onClick={() => {
            onSubmit({
              ...form,
              pricing: pricingRequest(prices),
              name: form.name.trim(),
              model: form.model.trim(),
              baseUrl: (form.baseUrl ?? '').trim() || null,
              apiKey: (form.apiKey ?? '').trim() || null,
            })
          }}
        >
          {t('analytics.settings.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
