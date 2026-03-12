import { toast } from 'sonner'

type ToastType = 'success' | 'error' | 'info' | 'warning'

const borderColorMap: Record<ToastType, string> = {
  error: '#f4482a',
  warning: '#f4482a',
  success: '#2a75f4',
  info: '#2a75f4',
}

const iconColorMap: Record<ToastType, string> = {
  error: '#f4482a',
  warning: '#f4482a',
  success: '#2a75f4',
  info: '#2a75f4',
}

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
      stroke="#222124"
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
}

const ToastContent = ({ id, type, title, description }: ToastContentProps) => (
  <div
    style={{
      background: '#ffffff',
      borderLeft: `4px solid ${borderColorMap[type]}`,
      borderRadius: '8px',
      boxShadow: '0px 3px 24px 0px rgba(42, 117, 244, 0.4)',
      padding: '12px 16px',
      width: '351px',
      display: 'flex',
      flexDirection: description ? 'column' : 'row',
      gap: '6px',
      overflow: 'hidden',
      fontFamily: "'Google Sans', system-ui, sans-serif",
    }}
  >
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <AttentionIcon color={iconColorMap[type]} />
      <span
        style={{
          flex: 1,
          fontWeight: 700,
          fontSize: '16px',
          color: '#222124',
          minWidth: 0,
        }}
      >
        {title}
      </span>
      <span onClick={() => toast.dismiss(id)}>
        <CloseIcon />
      </span>
    </div>
    {description && (
      <span
        style={{
          fontWeight: 500,
          fontSize: '14px',
          color: '#222124',
        }}
      >
        {description}
      </span>
    )}
  </div>
)

export const showToast = (
  type: ToastType,
  title: string,
  description?: string
) => {
  toast.custom((id) => (
    <ToastContent id={id} type={type} title={title} description={description} />
  ))
}
