import HeadsetMicIcon from '@mui/icons-material/HeadsetMic'
import {
  GridLayout,
  ParticipantTile,
  isTrackReference,
  useRemoteParticipants,
  useTracks,
} from '@livekit/components-react'
import { Track } from 'livekit-client'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { cssVar, palette } from '@/shared/design/tokens'

import { startRingback } from '../lib/call-sounds'

/**
 * Сцена разговора.
 *
 * <p><b>Показанный экран занимает её целиком.</b> Ради экрана звонок и затевается: на нём мелкий
 * бухгалтерский текст, суммы и коды счетов, и в трети окна разобрать их невозможно. Плиток
 * участников рядом нет — камеру в этом контуре включить нечем, так что рядом с экраном стояли бы
 * два прямоугольника с именами, а имена и так написаны в шапке окна.
 */
export const RoomStage = ({ isCaller }: { isCaller: boolean }) => {
  const { t } = useTranslation()
  const peers = useRemoteParticipants()
  const alone = peers.length === 0

  // Гудок ожидания — только у звонящего и только пока он в комнате один. Без него человек
  // смотрит в тишину и не понимает, идёт вызов или всё сломалось; смолкает гудок ровно в тот
  // момент, когда поддержка подключилась, и это единственный сигнал «вас взяли», который
  // слышно, не глядя в экран. Агенту он не положен: агент никого не вызывает — если он остался
  // один, значит собеседник ушёл, и гудок сказал бы ровно обратное правде.
  useEffect(() => {
    if (!alone || !isCaller) {
      return undefined
    }
    return startRingback()
  }, [alone, isCaller])

  // Камера остаётся в списке с заглушкой, хотя включить её нечем: именно заглушка рисует
  // плитку участника с именем. Без неё собеседник, который ничего не показывает, исчезал бы
  // из окна совсем.
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  )

  const screenShare = tracks
    .filter(isTrackReference)
    .find((track) => track.source === Track.Source.ScreenShare)

  if (screenShare) {
    return <ParticipantTile trackRef={screenShare} className="h-full w-full" />
  }

  if (peers.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <span className="relative flex h-14 w-14 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-02/30" />
          <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-accent-02">
            <HeadsetMicIcon
              sx={{ fontSize: 22, color: cssVar(palette.ui01) }}
            />
          </span>
        </span>
        <span className="text-body1 text-ui-03">
          {t(isCaller ? 'support.waitingForAgent' : 'support.peerLeft')}
        </span>
      </div>
    )
  }

  return (
    <GridLayout tracks={tracks} style={{ height: '100%' }}>
      <ParticipantTile />
    </GridLayout>
  )
}
