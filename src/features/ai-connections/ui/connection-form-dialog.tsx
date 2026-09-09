import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'

import type { LlmProvider } from '@/entities/analytics'
import type { AiConnection, AiConnectionUpdate } from '@/entities/ai-connection'
import { Button } from '@/shared/ui/buttons'
import type { TranslationKey } from '@/shared/types/i18n.types'

/** Провайдеры общие для обоих контуров, подписи берём из ключей аналитики. */
const PROVIDERS: { value: LlmProvider; labelKey: TranslationKey }[] = [
  { value: 'LOCAL', labelKey: 'analytics.settings.providerLocal' },
  { value: 'ANTHROPIC', labelKey: 'analytics.settings.providerAnthropic' },
  { value: 'OPENAI', labelKey: 'analytics.settings.providerOpenai' },
  { value: 'OPENROUTER', labelKey: 'analytics.settings.providerOpenrouter' },
]

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
 * Форма подключения.
 *
 * <p>Здесь описываются провайдер, ключ и модель — один раз. Контуры потом только
 * выбирают из готовых, поэтому три модели одного провайдера заводятся тремя
 * подключениями с одним ключом, а не тремя копиями настроек.
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
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

          <TextField
            select
            label={t('analytics.settings.provider')}
            value={form.provider}
            onChange={(event) => {
              // Смена провайдера очищает модель: идентификаторы у провайдеров свои.
              patch({ provider: event.target.value as LlmProvider, model: '' })
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
            helperText={t('analytics.settings.modelHint')}
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
            value={form.baseUrl ?? ''}
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
            value={form.apiKey ?? ''}
            onChange={(event) => {
              patch({ apiKey: event.target.value })
            }}
          />

          <div className="flex gap-4">
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
