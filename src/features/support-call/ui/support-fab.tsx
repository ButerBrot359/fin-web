import { Tooltip } from '@mui/material'
import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils/cn'
import { WIDGET_LAUNCHER_CONFIG } from '@/shared/lib/widgets/widget-launchers'

export type FabTone = 'brand' | 'alert' | 'live'

const TONE_CLASSES: Record<FabTone, string> = {
  brand: 'bg-accent-01 text-ui-06 hover:bg-accent-01-hover',
  alert: 'bg-support-01 text-ui-01 hover:brightness-95',
  live: 'bg-accent-02 text-ui-01 hover:brightness-95',
}

const RING_CLASSES: Record<FabTone, string> = {
  brand: 'bg-accent-01/40',
  alert: 'bg-support-01/40',
  live: 'bg-accent-02/40',
}

/**
 * Круглая кнопка виджета.
 *
 * <p>Три оттенка вместо трёх разных элементов: обычное состояние — фирменный лайм, как у любой
 * главной кнопки webbuh; ждущий ответа звонок — красный; возврат в идущий разговор — синий.
 * Пульсация привязана только к ожиданию ответа: она означает «нужно ответить», а не «что-то
 * происходит».
 */
export const SupportFab = ({
  tone,
  label,
  badge,
  pulsing,
  onClick,
  children,
}: {
  tone: FabTone
  label: string
  badge?: number
  pulsing?: boolean
  onClick: () => void
  children: ReactNode
}) => (
  <Tooltip title={label} placement="left">
    <span
      className="relative inline-flex"
      style={
        WIDGET_LAUNCHER_CONFIG.showFloatingButtons
          ? undefined
          : { display: 'none' }
      }
    >
      {pulsing && (
        <span
          className={cn(
            'absolute inset-0 animate-ping rounded-full',
            RING_CLASSES[tone]
          )}
        />
      )}
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(
          'relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full shadow-call-glow transition-all',
          TONE_CLASSES[tone]
        )}
      >
        {children}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-ui-06 px-1 text-[11px] font-medium text-ui-01">
            {badge}
          </span>
        )}
      </button>
    </span>
  </Tooltip>
)
