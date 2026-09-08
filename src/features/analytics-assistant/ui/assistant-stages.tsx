import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { cn } from '@/shared/lib/utils/cn'

import { GENERATION_STAGE_KEYS } from '../lib/hooks/use-generation-stage'
import { MicroLabel } from '@/shared/ui/micro-label'

interface AssistantStagesProps {
  /** Индекс текущего этапа: предыдущие пройдены, следующие ещё впереди. */
  stage: number
}

/** Отметка пройденного этапа — рисуем сами, галочки в наборе иконок нет. */
const DoneMark = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3 text-accent-02" aria-hidden>
    <path
      d="M2 6.4 4.7 9 10 3.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/**
 * Этапы генерации вместо скелетона.
 *
 * Ожидание длится больше минуты, и пустой мигающий прямоугольник не отвечает
 * на единственный вопрос человека — работает система или зависла. Показываем
 * стадию: текущая подсвечена, пройденные отмечены. Пульсация — только у
 * текущего шага и только там, где движение разрешено настройками системы.
 */
export const AssistantStages = ({ stage }: AssistantStagesProps) => {
  const { t } = useTranslation()

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-3 rounded-lg bg-ui-01 p-4"
    >
      <MicroLabel>{t('analytics.assistant.stagesLabel')}</MicroLabel>

      <ol className="flex flex-col gap-2.5">
        {GENERATION_STAGE_KEYS.map((key, index) => {
          const isDone = index < stage
          const isCurrent = index === stage

          return (
            <li key={key} className="flex items-center gap-2.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {isDone ? (
                  <DoneMark />
                ) : (
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      isCurrent
                        ? 'bg-accent-01 motion-safe:animate-pulse'
                        : 'bg-ui-03'
                    )}
                  />
                )}
              </span>

              <Typography
                variant="body2"
                className={cn(
                  isCurrent && 'font-semibold text-ui-06',
                  isDone && 'text-ui-05',
                  !isCurrent && !isDone && 'text-ui-05/60'
                )}
              >
                {t(key)}
              </Typography>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
