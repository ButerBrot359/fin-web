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
import { Button } from '@/shared/ui/buttons'

import { ApiKeyField } from './api-key-field'
import { ModelAutocomplete } from './model-autocomplete'
import { ProviderSelector } from './provider-selector'

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
})

/**
 * Форма подключения к ИИ.
 *
 * <p>Провайдер выбирается карточками, а модель — автокомплитом с каталогом провайдера:
 * оба компонента переехали сюда из прежней формы настроек аналитики, где были написаны и
 * обкатаны. Выпадающий список провайдеров и поле модели без каталога, которые я сделал
 * раньше, были шагом назад — у OpenRouter сотни моделей, и вписывать идентификатор
 * вручную по памяти невозможно.
 *
 * <p>Диалог широкий ({@code maxWidth="md"}): карточки провайдеров в узком окне
 * переносятся на три строки и перестают читаться как один ряд вариантов.
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
  const [syncedId, setSyncedId] = useState<number | null>(
    connection?.id ?? null
  )

  // Перезаполнение в рендере, а не в эффекте: линтер проекта запрещает setState
  // в эффекте, и лишний проход показал бы форму с чужими значениями.
  if ((connection?.id ?? null) !== syncedId) {
    setSyncedId(connection?.id ?? null)
    setForm(emptyForm(connection))
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
            helperText={t('aiConnections.nameHint')}
            value={form.name}
            onChange={(event) => {
              patch({ name: event.target.value })
            }}
          />

          <ProviderSelector
            value={form.provider}
            onChange={(next: LlmProvider) => {
              // Смена провайдера очищает модель: идентификаторы у провайдеров свои,
              // и модель Claude в OpenAI не существует.
              patch({ provider: next, model: '' })
            }}
          />

          <ModelAutocomplete
            provider={form.provider}
            baseUrl={form.baseUrl ?? ''}
            value={form.model}
            onChange={(model) => {
              patch({ model })
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
            value={form.baseUrl ?? ''}
            // Браузер принимал это поле за имя и подставлял в него ФИО пользователя.
            // `off` современные браузеры на текстовых полях игнорируют, а незанятое
            // значение вроде `url` уводит эвристику от адресной книги.
            autoComplete="url"
            name="ai-connection-base-url"
            onChange={(event) => {
              patch({ baseUrl: event.target.value })
            }}
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

          {/* Сеткой, а не флексом: у полей есть подписи снизу, и во флекс-строке
              длинная подсказка «Максимум токенов» наезжала на соседнее поле. */}
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
              helperText={t('aiConnections.maxTokensHint')}
              value={form.maxTokens}
              onChange={(event) => {
                patch({ maxTokens: Number(event.target.value) })
              }}
            />
          </div>

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
          disabled={isSaving || incomplete}
          onClick={() => {
            onSubmit({
              ...form,
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
