import ScreenShareIcon from '@mui/icons-material/ScreenShare'
import { isTrackReference, useTracks } from '@livekit/components-react'
import { Track } from 'livekit-client'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/utils/cn'

/**
 * Кто сейчас показывает экран (ADR-0050).
 *
 * <p><b>Показ экрана обязан быть виден тому, кто показывает.</b> Человек включает его один раз и
 * дальше работает в webbuh, забывая, что поддержка всё это время смотрит его экран — а на экране
 * бухгалтера госучреждения зарплаты, лицевые счета и персональные данные. Одной подсветки кнопки
 * для этого мало: кнопка не видна, когда окно разговора свёрнуто, и её легко не заметить,
 * когда развёрнуто.
 *
 * <p>Свой показ и чужой различаются текстом: «показываете вы» — предупреждение, «показывает
 * собеседник» — просто факт.
 */
export const ScreenShareBadge = ({ className }: { className?: string }) => {
  const { t } = useTranslation()

  const shares = useTracks(
    [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
    {
      onlySubscribed: false,
    }
  ).filter(isTrackReference)

  const own = shares.find((share) => share.participant.isLocal)
  const peer = shares.find((share) => !share.participant.isLocal)

  if (!own && !peer) {
    return null
  }

  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-body2',
        own ? 'bg-accent-02 text-ui-01' : 'bg-ui-04 text-accent-02',
        className
      )}
    >
      <ScreenShareIcon sx={{ fontSize: 16 }} />
      {own
        ? t('support.sharing')
        : t('support.sharingByPeer', {
            name: peer?.participant.name ?? peer?.participant.identity ?? '',
          })}
    </span>
  )
}
