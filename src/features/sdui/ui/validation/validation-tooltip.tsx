import type { FC } from 'react'
import { Popper, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import CrossIcon from '@/shared/assets/icons/cross.svg'
import { cssVar, shadows } from '@/shared/design/tokens'
import type { ValidationMessage } from '@/entities/validation-report'

interface ValidationTooltipProps {
  anchorEl: Element | null
  message: ValidationMessage
  /** Позиция активного сообщения среди навигируемых, 1-based. */
  position: number
  total: number
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}

/**
 * Тултип-навигатор у проблемного поля (SCRUM-317, Figma «Ошибки» → «Тултип»):
 * стрелки «‹ ›» обходят ТОЛЬКО сообщения с валидным target. Слой ВЫШЕ панели
 * (v2 §7): при наложении орган управления обязан остаться доступным. Иконка
 * копирования — текст текущего сообщения (v1 §3.5).
 */
export const ValidationTooltip: FC<ValidationTooltipProps> = ({
  anchorEl,
  message,
  position,
  total,
  onPrev,
  onNext,
  onClose,
}) => {
  const { t } = useTranslation()
  if (!anchorEl) return null

  return (
    <Popper
      open
      anchorEl={anchorEl}
      placement="bottom-start"
      sx={{ zIndex: 1450 }}
      modifiers={[
        { name: 'offset', options: { offset: [0, 8] } },
        { name: 'flip', options: { fallbackPlacements: ['top-start'] } },
      ]}
    >
      <div
        data-testid="validation-tooltip"
        className="w-[360px] rounded-lg bg-ui-01 p-3"
        style={{ boxShadow: cssVar(shadows.popup) }}
      >
        <div className="flex items-center gap-2">
          <span className="text-support-01">⚠</span>
          <Typography variant="body2" className="flex-1 font-bold text-ui-06">
            {t('sdui.validation.tooltipTitle')}
          </Typography>
          <Typography variant="body2" className="text-ui-05">
            {t('sdui.validation.position', { position, total })}
          </Typography>
          <button
            type="button"
            aria-label={t('sdui.validation.prev')}
            onClick={onPrev}
            disabled={total < 2}
            className="cursor-pointer px-1 text-ui-06 disabled:cursor-default disabled:text-ui-05"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={t('sdui.validation.next')}
            onClick={onNext}
            disabled={total < 2}
            className="cursor-pointer px-1 text-ui-06 disabled:cursor-default disabled:text-ui-05"
          >
            ›
          </button>
          <button
            type="button"
            aria-label={t('sdui.validation.copy')}
            title={t('sdui.validation.copy')}
            onClick={() => {
              void navigator.clipboard.writeText(message.message)
            }}
            className="cursor-pointer px-1 text-ui-06"
          >
            ⧉
          </button>
          <button
            type="button"
            aria-label={t('sdui.validation.close')}
            onClick={onClose}
            className="shrink-0 cursor-pointer"
          >
            <CrossIcon className="h-4 w-4" />
          </button>
        </div>
        <Typography variant="body2" className="mt-2 text-ui-06">
          {message.message}
        </Typography>
      </div>
    </Popper>
  )
}
