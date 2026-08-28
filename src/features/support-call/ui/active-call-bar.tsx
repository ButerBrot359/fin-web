import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import { Grow } from '@mui/material'
import {
  useRemoteParticipants,
  useRoomContext,
  useTrackToggle,
} from '@livekit/components-react'
import { Track } from 'livekit-client'
import { useTranslation } from 'react-i18next'

import { callSounds } from '../lib/call-sounds'
import { ScreenShareBadge } from './screen-share-badge'

/** Секунды в «мм:сс». Часы не нужны: разговор с поддержкой такой длины — сам по себе новость. */
const formatElapsed = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

interface ActiveCallBarProps {
  /** Сколько идёт разговор. Считает окно разговора: плашка исчезает при каждом развороте. */
  seconds: number
  onRestore: () => void
  /** Объявить намерение положить трубку; соединение рвётся здесь же, следом. */
  onHangUp: () => void
}

/**
 * Свёрнутый разговор (ADR-0050).
 *
 * <p>Окно разговора модальное, а показ экрана нужен ровно тогда, когда человек хочет
 * <b>продолжать работать</b> — открыть документ, повторить действие, показать ошибку. Свёрнутое
 * состояние отдаёт ему интерфейс обратно, не трогая соединение: комната остаётся подключённой,
 * звук идёт, показ экрана продолжается.
 *
 * <p>Поэтому плашка обязана говорить, что разговор ЖИВ, а не просто занимать угол: пульсирующая
 * точка, таймер, имя собеседника и честное «показываете экран» — человек должен видеть, что его
 * экран всё ещё видят. Положить трубку можно прямо отсюда, не разворачивая окно.
 */
export const ActiveCallBar = ({
  seconds,
  onRestore,
  onHangUp,
}: ActiveCallBarProps) => {
  const { t } = useTranslation()
  const peers = useRemoteParticipants()
  const mic = useTrackToggle({ source: Track.Source.Microphone })
  const room = useRoomContext()

  const peerNames = peers.map((peer) => peer.name ?? peer.identity).join(', ')

  return (
    <Grow in appear>
      <div className="fixed right-6 bottom-20 z-[1050] w-72 overflow-hidden rounded-[20px] bg-ui-01 shadow-[0px_3px_24px_0px_rgba(42,117,244,0.4)]">
        <div className="flex items-center gap-2 bg-ui-06 px-4 py-2.5 text-ui-01">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-01" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-01" />
          </span>
          <span className="flex-1 truncate text-body2">
            {t('support.miniTitle')}
          </span>
          <span className="text-body2 tabular-nums opacity-80">
            {formatElapsed(seconds)}
          </span>
        </div>

        <div className="px-4 pt-3">
          {peerNames && (
            <p className="truncate text-body2 text-ui-06" title={peerNames}>
              {peerNames}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ScreenShareBadge />
            {!mic.enabled && (
              <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-support-01/10 px-3 py-1.5 text-body2 text-support-01">
                <MicOffIcon sx={{ fontSize: 16 }} />
                {t('support.miniMuted')}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              if (mic.enabled) {
                callSounds.micOff()
              } else {
                callSounds.micOn()
              }
              void mic.toggle()
            }}
            disabled={mic.pending}
            aria-label={t(mic.enabled ? 'support.micOff' : 'support.micOn')}
            title={t(mic.enabled ? 'support.micOff' : 'support.micOn')}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-ui-02 text-ui-06 transition-colors hover:bg-ui-04 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mic.enabled ? (
              <MicIcon sx={{ fontSize: 18 }} />
            ) : (
              <MicOffIcon sx={{ fontSize: 18 }} />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              callSounds.restore()
              onRestore()
            }}
            className="flex-1 cursor-pointer rounded-md bg-accent-01 py-2 text-body2 text-ui-06 transition-all hover:bg-accent-01-hover hover:shadow-primary-hover active:bg-accent-01-pressed active:shadow-none"
          >
            {t('support.miniRestore')}
          </button>

          <button
            type="button"
            onClick={() => {
              callSounds.hangUp()
              // Порядок тот же, что и в панели разговора: сначала намерение, потом разрыв —
              // иначе обработчик отключения не отличит «положил трубку» от любого другого.
              onHangUp()
              void room.disconnect()
            }}
            aria-label={t('support.leave')}
            title={t('support.leave')}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-support-01 text-ui-01 transition-all hover:brightness-95"
          >
            <CallEndIcon sx={{ fontSize: 18 }} />
          </button>
        </div>
      </div>
    </Grow>
  )
}
