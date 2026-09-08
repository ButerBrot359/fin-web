import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { MicroLabel } from '@/shared/ui/micro-label'

interface AssistantEmptyStateProps {
  /** Клик по примеру — подставляет текст в поле ввода. */
  onExampleClick: (text: string) => void
}

const EXAMPLE_KEYS = [
  'analytics.assistant.example1',
  'analytics.assistant.example2',
  'analytics.assistant.example3',
] as const

/**
 * Пустое состояние ленты: строка о том, что делает ассистент, и три примера.
 *
 * Примеры — строки, разделённые волосяной линией, а не кнопки-«таблетки»:
 * пример читают целиком как готовую формулировку, а не выбирают из набора.
 */
export const AssistantEmptyState = ({
  onExampleClick,
}: AssistantEmptyStateProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-ui-01 p-4">
      <Typography variant="body2" className="text-ui-06">
        {t('analytics.assistant.emptyHint')}
      </Typography>

      <div className="flex flex-col gap-1">
        <MicroLabel>{t('analytics.assistant.examples')}</MicroLabel>

        <div className="flex flex-col divide-y divide-ui-03">
          {EXAMPLE_KEYS.map((key) => {
            const text = t(key)

            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onExampleClick(text)
                }}
                className="group flex cursor-pointer items-start gap-3 py-2.5 text-left"
              >
                <Typography
                  component="span"
                  variant="body2"
                  className="flex-1 text-ui-06 transition-colors group-hover:text-accent-02"
                >
                  {text}
                </Typography>
                <span
                  aria-hidden
                  className="mt-0.5 text-body2 text-ui-03 transition-colors group-hover:text-accent-02"
                >
                  →
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
