import { toast } from 'sonner'

import { cssVar, palette, semantic, shadows } from '@/shared/design/tokens'

type ToastType = 'success' | 'error' | 'info' | 'warning'

// Роли по Figma: error = Support 01, warning = Support 03 (жёлтый),
// success = Support 02 (зелёный), info = Accent 02 — раньше warning красился
// как error, success как info (токенов support02/03 не существовало).
const borderColorMap: Record<ToastType, string> = {
  error: cssVar(semantic.error),
  warning: cssVar(semantic.warning),
  success: cssVar(semantic.success),
  info: cssVar(semantic.primary),
}

const iconColorMap: Record<ToastType, string> = borderColorMap

const AttentionIcon = ({ color }: { color: string }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    style={{ flexShrink: 0 }}
  >
    <path
      d="M8.57 3.22 1.51 15.5c-.18.32-.28.68-.28 1.05 0 1.1.9 2 2 2h14.14c1.1 0 2-.9 2-2 0-.37-.09-.73-.28-1.05L12.03 3.22a2.004 2.004 0 0 0-3.46 0Z"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10.3 7.5v4"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="10.3" cy="14" r="0.75" fill={color} />
  </svg>
)

const CloseIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    style={{ flexShrink: 0, cursor: 'pointer' }}
  >
    <path
      d="M5 5l10 10M15 5L5 15"
      stroke={cssVar(semantic.textPrimary)}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

interface ToastContentProps {
  id: string | number
  type: ToastType
  title: string
  description?: string
  onClick?: () => void
}

const ToastContent = ({
  id,
  type,
  title,
  description,
  onClick,
}: ToastContentProps) => (
  <div
    onClick={
      onClick
        ? () => {
            onClick()
            toast.dismiss(id)
          }
        : undefined
    }
    style={{
      background: cssVar(palette.ui01),
      borderLeft: `4px solid ${borderColorMap[type]}`,
      borderRadius: '8px',
      boxShadow: cssVar(shadows.popup),
      padding: '12px 16px',
      width: '351px',
      display: 'flex',
      flexDirection: description ? 'column' : 'row',
      gap: '6px',
      overflow: 'hidden',
      fontFamily: "'Google Sans', system-ui, sans-serif",
      cursor: onClick ? 'pointer' : undefined,
    }}
  >
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <AttentionIcon color={iconColorMap[type]} />
      <span
        style={{
          flex: 1,
          fontWeight: 700,
          fontSize: '16px',
          color: cssVar(semantic.textPrimary),
          minWidth: 0,
        }}
      >
        {title}
      </span>
      <span
        onClick={(e) => {
          // Крестик закрывает всплывашку, не срабатывая как переход по ней.
          e.stopPropagation()
          toast.dismiss(id)
        }}
      >
        <CloseIcon />
      </span>
    </div>
    {description && (
      <span
        style={{
          fontWeight: 500,
          fontSize: '14px',
          color: cssVar(semantic.textPrimary),
        }}
      >
        {description}
      </span>
    )}
  </div>
)

export interface ToastEvent {
  type: ToastType
  title: string
  description?: string
  /** Готовый маршрут фронта (notify.route) — для истории оповещений. */
  route?: string | null
}

type ToastListener = (event: ToastEvent) => void

// SCRUM-317 канал №8: центр оповещений копит всё, что показано всплывашкой.
// Подписка вместо прямого импорта — shared не знает про entities-стор.
const listeners = new Set<ToastListener>()

export function onToastShown(listener: ToastListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export interface ShowToastOptions {
  /**
   * Клик по всплывашке (кроме крестика). SCRUM-317 §4.1: notify.route делает
   * всплывашку кликабельной, но сам по себе перехода НЕ вызывает.
   */
  onClick?: () => void
  route?: string | null
}

export const showToast = (
  type: ToastType,
  title: string,
  description?: string,
  opts?: ShowToastOptions
) => {
  for (const listener of listeners) {
    listener({ type, title, description, route: opts?.route ?? null })
  }
  toast.custom((id) => (
    <ToastContent
      id={id}
      type={type}
      title={title}
      description={description}
      onClick={opts?.onClick}
    />
  ))
}
