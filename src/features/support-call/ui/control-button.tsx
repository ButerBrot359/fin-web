import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils/cn'

/**
 * Кнопка панели разговора.
 *
 * <p>Своя, а не `TrackToggle` из LiveKit: тот приносит собственную тёмную тему и подпись,
 * которая не меняется при переключении — «Выключить микрофон» оставалось на кнопке и после
 * того, как микрофон уже выключен. Поведение берётся из хука, вид — из палитры webbuh.
 */
export const ControlButton = ({
  icon,
  label,
  title,
  active,
  danger,
  disabled,
  onClick,
}: {
  icon: ReactNode
  label: string
  /** Подсказка при наведении, когда подписи мало. По умолчанию — сама подпись. */
  title?: string
  /** Действие сейчас включено — кнопка горит фирменным лаймом. */
  active?: boolean
  /** Разрушающее действие: завершить разговор. */
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title ?? label}
    className={cn(
      'flex cursor-pointer items-center gap-2 rounded-md py-2.5 pl-3 pr-4 text-body2 whitespace-nowrap transition-all',
      'disabled:cursor-not-allowed disabled:opacity-60',
      danger
        ? 'bg-support-01 text-white hover:brightness-95'
        : active
          ? 'bg-accent-01 text-ui-06 hover:bg-accent-01-hover'
          : 'bg-ui-02 text-ui-06 hover:bg-ui-04'
    )}
  >
    <span className="flex h-5 w-5 items-center justify-center">{icon}</span>
    {label}
  </button>
)
