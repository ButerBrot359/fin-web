import { type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'

interface AssistantComposerProps {
  disabled: boolean
  readOnly?: boolean
  value: string
  onChange: (value: string) => void
  onSend: (question: string) => void
}

/**
 * Строка ввода, закреплённая внизу панели.
 *
 * Закрепление — отдельный критерий приёмки: при длинном ответе прокручивается
 * только история, а поле и кнопка остаются на месте. Достигается тем, что этот
 * блок лежит вне области прокрутки (`shrink-0` у контейнера панели), а не
 * position: sticky, — sticky внутри флекс-колонки с overflow даёт дрожание при
 * инерционной прокрутке.
 *
 * Enter отправляет, Shift+Enter переносит строку — как в ассистенте аналитики,
 * чтобы две панели не вели себя по-разному.
 */
export const AssistantComposer = ({
  disabled,
  readOnly = false,
  value,
  onChange,
  onSend,
}: AssistantComposerProps) => {
  const { t } = useTranslation()

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    onChange('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex min-w-0 shrink-0 flex-col gap-2 border-t border-ui-03 bg-ui-01 p-3">
      <textarea
        rows={2}
        value={value}
        disabled={readOnly}
        placeholder={t('aiAssistant.placeholder')}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        onKeyDown={handleKeyDown}
        className="resize-none rounded-lg border border-transparent bg-ui-02 px-3 py-2 text-body2 outline-none focus:border-accent-02"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-caption text-ui-05">
          {t('aiAssistant.enterHint')}
        </span>
        <Button
          size="small"
          variant="primary"
          disabled={disabled || value.trim() === ''}
          onClick={submit}
        >
          {t('aiAssistant.send')}
        </Button>
      </div>
    </div>
  )
}
