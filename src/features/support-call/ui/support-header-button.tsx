import HeadsetMicIcon from '@mui/icons-material/HeadsetMic'
import { Badge, Tooltip } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/features/auth/lib/hooks/use-auth-store'
import { Button } from '@/shared/ui/buttons'
import { openSupportWidget } from '@/shared/lib/widgets/widget-launchers'
import { useSupportQueue } from '../model/use-support-call'

export function SupportHeaderButton() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const isAgent = Boolean(user?.supportAgent)
  const { data: calls } = useSupportQueue(isAgent)
  if (!user) return null
  const waiting = calls?.filter((call) => call.status === 'WAITING').length ?? 0
  const label = t(
    isAgent
      ? waiting > 0
        ? 'support.fabIncoming'
        : 'support.fabQueue'
      : 'support.fabCall'
  )
  return (
    <Tooltip title={label}>
      <span>
        <Button
          variant="tertiary"
          aria-label={label}
          onClick={openSupportWidget}
          startIcon={
            <Badge badgeContent={waiting} color="error">
              <HeadsetMicIcon sx={{ fontSize: 20 }} />
            </Badge>
          }
        />
      </span>
    </Tooltip>
  )
}
