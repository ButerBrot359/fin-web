import CallEndIcon from '@mui/icons-material/CallEnd'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import CloseIcon from '@mui/icons-material/Close'
import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import {
  DisconnectButton,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  TrackToggle,
  useTracks,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { DisconnectReason, Track } from 'livekit-client'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { SupportCallSession } from '../model/types'

interface CallRoomDialogProps {
  session: SupportCallSession
  /**
   * Разговор закончился.
   *
   * @param byUser закончил сам человек — нажал «Завершить» или закрыл окно. `false`, когда
   *   отключил медиасервер: так приходит конец разговора, завершённого собеседником, и так же
   *   выглядит потерянная связь. Разница важна: завершать обращение на сервере должна та
   *   сторона, которая этого захотела, а не та, у которой отвалилась сеть.
   */
  onClose: (byUser: boolean) => void
}

/**
 * Комната разговора (ADR-0050).
 *
 * <p>Раскладка собрана из примитивов LiveKit, а не из готового `VideoConference`: тот
 * зашивает англоязычные подписи кнопок, а интерфейс webbuh двуязычный. Из примитивов
 * берётся ровно то же поведение, но подписи наши.
 *
 * <p>Камера при входе НЕ включается, микрофон включается. Так устроен звонок в поддержку:
 * человеку нужно, чтобы услышали и посмотрели на его экран, а не разглядывали его самого.
 *
 * <p><b>Окно закрывается только явным действием</b> — кнопкой «Завершить» или крестиком.
 * Ни щелчок мимо окна, ни Esc разговор не обрывают: закрытие окна теперь заканчивает звонок
 * у обеих сторон, и случайное движение мышью не должно стоить собеседнику разговора.
 */
export const CallRoomDialog = ({ session, onClose }: CallRoomDialogProps) => {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)

  return (
    <Dialog open fullWidth maxWidth="lg">
      <DialogTitle
        sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}
      >
        <Typography variant="h6" component="span" sx={{ flexGrow: 1 }}>
          {session.role === 'AGENT'
            ? t('support.roomTitleAgent')
            : t('support.roomTitleCaller')}
        </Typography>

        {/* Индикатор записи виден ВЕСЬ разговор, а не только в момент согласия:
            человек должен в любой момент знать, что его пишут. */}
        {session.recording && (
          <Chip
            size="small"
            color="error"
            variant="outlined"
            icon={<FiberManualRecordIcon />}
            label={t('support.recording')}
          />
        )}

        <IconButton
          onClick={() => {
            onClose(true)
          }}
          aria-label={t('support.leave')}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, height: '70vh' }}>
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ height: '100%' }} data-lk-theme="default">
          <LiveKitRoom
            serverUrl={session.serverUrl}
            token={session.accessToken}
            connect
            audio
            video={false}
            onError={(e) => {
              setError(e.message)
            }}
            // Кнопка «Завершить» отключает нас саму — отсюда CLIENT_INITIATED. Всё
            // остальное (ROOM_DELETED от завершившего собеседника, обрыв связи) — не наше
            // решение, и закрывать обращение на сервере в этих случаях не нужно.
            onDisconnected={(reason) => {
              onClose(reason === DisconnectReason.CLIENT_INITIATED)
            }}
            style={{ height: '100%' }}
          >
            <RoomStage />
            {/* Звук участников: без него собеседника видно, но не слышно. */}
            <RoomAudioRenderer />
          </LiveKitRoom>
        </Box>
      </DialogContent>

      <Box sx={{ px: 3, pb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          {t('support.shareHint')}
        </Typography>
      </Box>
    </Dialog>
  )
}

/** Видео участников и локализованная панель управления. */
const RoomStage = () => {
  const { t } = useTranslation()

  // Камера и демонстрация экрана в одной сетке: показ экрана в WebRTC — это обычная
  // видеодорожка, и отдельной раскладки под неё не нужно.
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  )

  return (
    <Stack sx={{ height: '100%' }}>
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <GridLayout tracks={tracks} style={{ height: '100%' }}>
          <ParticipantTile />
        </GridLayout>
      </Box>

      <Stack
        direction="row"
        spacing={1}
        justifyContent="center"
        sx={{ p: 1.5, flexWrap: 'wrap' }}
        className="lk-control-bar"
      >
        <TrackToggle source={Track.Source.Microphone}>
          {t('support.micOff')}
        </TrackToggle>
        <TrackToggle source={Track.Source.Camera}>
          {t('support.cameraOn')}
        </TrackToggle>
        <TrackToggle source={Track.Source.ScreenShare}>
          {t('support.screenOn')}
        </TrackToggle>
        <DisconnectButton>
          <CallEndIcon fontSize="small" style={{ marginRight: 4 }} />
          {t('support.leave')}
        </DisconnectButton>
      </Stack>
    </Stack>
  )
}
