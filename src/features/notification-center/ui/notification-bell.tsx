import { useState } from 'react'
import { Badge, Popover } from '@mui/material'
import { useTranslation } from 'react-i18next'

import NotificationIcon from '@/shared/assets/icons/notification.svg'
import { Button } from '@/shared/ui/buttons'
import { useNotificationHistoryStore } from '@/entities/notification-history'

import { NotificationCenterPanel } from './notification-center-panel'

/**
 * Колокольчик шапки (SCRUM-317 канал №8): бейдж непрочитанных, по клику —
 * история оповещений за сеанс. Открытие поповера гасит бейдж.
 */
export const NotificationBell = () => {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const unread = useNotificationHistoryStore((s) => s.unread)
  const markAllRead = useNotificationHistoryStore((s) => s.markAllRead)

  return (
    <>
      <Button
        variant="tertiary"
        aria-label={t('notificationCenter.title')}
        onClick={(e) => {
          setAnchor(e.currentTarget)
          markAllRead()
        }}
        startIcon={
          <Badge badgeContent={unread} color="primary">
            <NotificationIcon className="h-5 w-5" />
          </Badge>
        }
      />
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => {
          setAnchor(null)
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {/* Переход по записи закрывает поповер — он не должен висеть поверх
            только что открытой карточки. */}
        <NotificationCenterPanel
          onNavigate={() => {
            setAnchor(null)
          }}
        />
      </Popover>
    </>
  )
}
