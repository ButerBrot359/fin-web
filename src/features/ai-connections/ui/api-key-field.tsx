import { useTranslation } from 'react-i18next'
import { TextField, Typography } from '@mui/material'

import { cn } from '@/shared/lib/utils/cn'

interface ApiKeyFieldProps {
  value: string
  /** Маска сохранённого ключа с сервера; пусто — ключ не задан. */
  savedMask?: string | null
  hasSavedKey: boolean
  /**
   * Ключ провайдеру не обязателен (своя модель). Меняет смысл пустого
   * состояния: «не задан» — недоделка, «не требуется» — штатный режим.
   */
  optional?: boolean
  onChange: (apiKey: string) => void
}

/**
 * Поле API-ключа.
 *
 * Сам ключ с сервера не приходит никогда — только маска вида «sk-…a91f».
 * Поэтому поле всегда стартует пустым, и пустое значение при сохранении
 * означает «оставить сохранённый ключ», а не «стереть его».
 *
 * Состояние ключа показываем строкой над полем, а не подписью под ним: это
 * факт «что сейчас лежит на сервере», и он должен читаться до ввода. Правило
 * «пустое поле — оставить сохранённый» остаётся подсказкой самого поля.
 */
export const ApiKeyField = ({
  value,
  savedMask,
  hasSavedKey,
  optional = false,
  onChange,
}: ApiKeyFieldProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-ui-02 px-3 py-2">
        <span
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            hasSavedKey ? 'bg-accent-02' : 'bg-ui-05'
          )}
        />
        <Typography variant="body2">
          {hasSavedKey
            ? t('analytics.settings.apiKeySaved')
            : optional
              ? t('analytics.settings.apiKeyNotNeeded')
              : t('analytics.settings.apiKeyNotSet')}
        </Typography>
        {hasSavedKey && savedMask ? (
          <Typography variant="body2" className="tabular-nums text-ui-05">
            {savedMask}
          </Typography>
        ) : null}
      </div>

      <TextField
        type="password"
        autoComplete="off"
        label={t('analytics.settings.apiKey')}
        helperText={t(
          optional
            ? 'analytics.settings.apiKeyHintLocal'
            : 'analytics.settings.apiKeyHint'
        )}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
    </div>
  )
}
