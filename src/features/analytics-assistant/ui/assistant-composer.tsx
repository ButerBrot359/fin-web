import type { ChangeEvent, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type { AnalyticsItemKind } from '@/entities/analytics'
import { Button } from '@/shared/ui/buttons'
import { cn } from '@/shared/lib/utils/cn'

import { MicroLabel } from '@/shared/ui/micro-label'

interface AssistantComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  kind: AnalyticsItemKind
  onKindChange: (kind: AnalyticsItemKind) => void
  isPending: boolean
}

/** `as const` обязателен: ключи перевода типизированы по ru/common.json. */
const KIND_OPTIONS = [
  { value: 'DASHBOARD', labelKey: 'analytics.assistant.kindDashboard' },
  { value: 'REPORT', labelKey: 'analytics.assistant.kindReport' },
] as const

/**
 * Ввод промпта: выбор вида представления, поле (Enter — отправка,
 * Shift+Enter — перенос) и «Построить».
 *
 * «Построить» — единственный акцент панели: переключатель приглушён до
 * микро-лейбла с сегментами, поле живёт на тонированной подложке без рамки.
 * Так в панели ровно одна кнопка, на которую хочется нажать.
 */
export const AssistantComposer = ({
  value,
  onChange,
  onSubmit,
  kind,
  onKindChange,
  isPending,
}: AssistantComposerProps) => {
  const { t } = useTranslation()

  const canSend = value.trim().length > 0 && !isPending

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    if (canSend) onSubmit()
  }

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value)
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-ui-01 p-3">
      <div className="flex items-center gap-3">
        <MicroLabel>{t('analytics.assistant.kind')}</MicroLabel>

        <div className="flex gap-0.5 rounded-md bg-ui-02 p-0.5">
          {KIND_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={kind === option.value}
              onClick={() => {
                onKindChange(option.value)
              }}
              className={cn(
                'cursor-pointer rounded-sm px-3 py-1 transition-colors',
                kind === option.value
                  ? 'bg-ui-01 text-ui-06'
                  : 'text-ui-05 hover:text-ui-06'
              )}
            >
              <Typography
                component="span"
                className={cn(
                  'text-[13px]',
                  kind === option.value && 'font-semibold'
                )}
              >
                {t(option.labelKey)}
              </Typography>
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={t('analytics.assistant.placeholder')}
        rows={3}
        disabled={isPending}
        className="w-full resize-none rounded-lg border border-transparent bg-ui-02 px-3 py-2 text-body2 text-ui-06 outline-none placeholder:text-ui-05 focus:border-accent-02 disabled:opacity-60"
      />

      <div className="flex items-center justify-between gap-3">
        <Typography component="span" className="text-[11px] text-ui-05">
          {t('analytics.assistant.enterHint')}
        </Typography>

        <Button variant="primary" disabled={!canSend} onClick={onSubmit}>
          {isPending
            ? t('analytics.assistant.generating')
            : t('analytics.assistant.send')}
        </Button>
      </div>
    </div>
  )
}
