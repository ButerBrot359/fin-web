import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import HeadsetMicIcon from '@mui/icons-material/HeadsetMic'
import {
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  isTrackReference,
  useConnectionState,
  useRemoteParticipants,
  useTracks,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { ConnectionState, Track } from 'livekit-client'
import type { CSSProperties, RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/utils/cn'

import type { SupportCallSession } from '../model/types'
import { ActiveCallBar } from './active-call-bar'
import { callSounds, startRingback } from '../lib/call-sounds'
import { useRemoteControlContext } from '../model/remote-control-context'
import { RemoteControlProvider } from '../model/remote-control-provider'
import { CallControls } from './call-controls'
import { RemoteControlBanner } from './remote-control-banner'
import { RemoteControlConsent } from './remote-control-consent'
import { RemoteControlSurface } from './remote-control-surface'
import { ScreenShareBadge } from './screen-share-badge'
import { SupportDialog } from './support-dialog'

/**
 * Тёмная сцена разговора в палитре webbuh.
 *
 * <p>LiveKit красит свои примитивы собственными переменными, и по умолчанию это чужая тёмно-серая
 * тема. Переопределяем их на цвета сайта — тогда плитки участников, подписи и рамки выглядят
 * частью webbuh, а не встроенным виджетом.
 */
const STAGE_THEME = {
  '--lk-bg': '#222124',
  '--lk-bg2': '#2f2e33',
  '--lk-bg3': '#3b3a40',
  '--lk-fg': '#ffffff',
  '--lk-fg2': '#c3cee0',
  '--lk-fg3': '#9fa9ba',
  '--lk-accent-bg': '#2a75f4',
  '--lk-accent-fg': '#ffffff',
  '--lk-danger': '#f4482a',
  '--lk-success': '#daf449',
  '--lk-border-color': 'rgba(255, 255, 255, 0.08)',
  '--lk-border-radius': '12px',
  '--lk-grid-gap': '12px',
  '--lk-font-family': '"Google Sans", system-ui, sans-serif',
} as const

interface CallRoomDialogProps {
  session: SupportCallSession
  /**
   * Разговор закончился.
   *
   * @param byUser человек сам положил трубку — нажал «Завершить» или закрыл окно. `false` для
   *   любого другого разрыва: разговор завершил собеседник, пропала связь, размонтировался
   *   компонент. Разница существенная: `true` закрывает обращение на сервере и рвёт комнату у
   *   обеих сторон, поэтому ошибиться здесь — значит завершить чужой разговор.
   */
  onClose: (byUser: boolean) => void
}

/**
 * Комната разговора (ADR-0050).
 *
 * <p>Раскладка собрана из примитивов LiveKit, а не из готового `VideoConference`: тот приносит
 * англоязычные подписи и собственную тему, а окно поддержки должно выглядеть как остальной
 * webbuh — человек попадает сюда в момент, когда у него уже что-то не работает.
 *
 * <p>Камера не включается и включить её нечем: звонок в поддержку — это «послушайте и посмотрите
 * на мой экран». Микрофон включается сразу, показ экрана — отдельной кнопкой, по решению самого
 * человека.
 *
 * <p><b>Закрыть окно нельзя — только свернуть или завершить разговор.</b> Крестик убран
 * намеренно: нажать его слишком легко, а стоит это обеим сторонам сразу. Сворачивание же
 * ничего не прерывает — комната остаётся подключённой, звук идёт, показ экрана продолжается,
 * а человек получает интерфейс обратно и может показывать поддержке свою проблему в webbuh.
 * Единственный способ положить трубку — кнопка «Завершить».
 */
export const CallRoomDialog = ({ session, onClose }: CallRoomDialogProps) => {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [minimized, setMinimized] = useState(false)

  /** Контейнер сцены: поверхность управления ищет внутри него видео с показанным экраном. */
  const stageRef = useRef<HTMLDivElement>(null)

  /**
   * Секунды разговора — счётчик живёт здесь, а не в свёрнутой плашке.
   *
   * <p>Плашка появляется и исчезает при каждом сворачивании, и её собственный счётчик обнулялся
   * бы вместе с ней. Это окно живёт весь разговор, поэтому и время считает оно.
   */
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((value) => value + 1)
    }, 1000)
    return () => {
      clearInterval(timer)
    }
  }, [])

  /**
   * Человек нажал «Завершить».
   *
   * <p>Признак хранится отдельно, а не выводится из причины разрыва: LiveKit помечает как
   * {@code CLIENT_INITIATED} любое отключение с нашей стороны, включая то, что случается при
   * размонтировании компонента. Из-за этого перезагрузка модуля или пересборка дерева React
   * выглядели как «положил трубку» и закрывали живое обращение — разговор шёл, показ экрана
   * работал, а звонок при этом считался завершённым.
   */
  const hangUpRequested = useRef(false)

  /**
   * Разговор уже закрыт этим окном.
   *
   * <p>Крестик закрывает окно сам, а следом размонтирование рвёт соединение и снова зовёт
   * обработчик разрыва. Без этого признака обращение закрывалось бы на сервере дважды.
   */
  const closed = useRef(false)

  const finish = (byUser: boolean) => {
    if (closed.current) {
      return
    }
    closed.current = true
    onClose(byUser)
  }

  return (
    // Провайдер комнаты снаружи диалога: строка состояния и панель управления живут в шапке и
    // подвале окна, а хуки LiveKit работают по положению в дереве React, а не в DOM.
    <LiveKitRoom
      serverUrl={session.serverUrl}
      token={session.accessToken}
      connect
      audio
      video={false}
      onError={(e) => {
        setError(e.message)
      }}
      onDisconnected={() => {
        finish(hangUpRequested.current)
      }}
      style={{ display: 'contents' }}
    >
      <RemoteControlProvider isCaller={session.role === 'CALLER'}>
        <RemoteControlLayer
          isCaller={session.role === 'CALLER'}
          stageRef={stageRef}
        />

        {minimized ? (
          <ActiveCallBar
            seconds={seconds}
            onRestore={() => {
              setMinimized(false)
            }}
            onHangUp={() => {
              hangUpRequested.current = true
            }}
          />
        ) : (
          <SupportDialog
            maxWidth="lg"
            dismissable={false}
            expanded={expanded}
            onToggleExpanded={() => {
              setExpanded((value) => !value)
            }}
            title={
              session.role === 'AGENT'
                ? t('support.roomTitleAgent')
                : t('support.roomTitleCaller')
            }
            subtitle={<RoomStatusLine />}
            headerSlot={
              <span className="mt-1 flex shrink-0 items-center gap-2">
                <ScreenShareBadge />
                {/* Индикатор записи виден ВЕСЬ разговор, а не только в момент согласия:
                  человек должен в любой момент знать, что его пишут. */}
                {session.recording && (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-support-01/10 px-3 py-1.5 text-body2 text-support-01">
                    <FiberManualRecordIcon sx={{ fontSize: 12 }} />
                    {t('support.recording')}
                  </span>
                )}
              </span>
            }
            onMinimize={() => {
              callSounds.minimize()
              setMinimized(true)
            }}
            footer={
              <div className="flex flex-col gap-4">
                <CallControls
                  isAgent={session.role === 'AGENT'}
                  onHangUp={() => {
                    hangUpRequested.current = true
                  }}
                />
                {!expanded && (
                  <p className="text-body2 text-ui-05">
                    {t('support.shareHint')}
                  </p>
                )}
              </div>
            }
            contentClassName="flex flex-col"
          >
            {error !== null && (
              <div className="mb-4 rounded-lg bg-support-01/10 px-4 py-3 text-body2 text-support-01">
                {error}
              </div>
            )}

            <div
              ref={stageRef}
              className={cn(
                'relative overflow-hidden rounded-lg bg-ui-06 p-3',
                expanded ? 'min-h-0 flex-1' : 'h-[58vh] min-h-[280px]'
              )}
              data-lk-theme="default"
              style={STAGE_THEME as CSSProperties}
            >
              <RoomStage isCaller={session.role === 'CALLER'} />
            </div>
          </SupportDialog>
        )}
      </RemoteControlProvider>

      {/* Звук участников — вне окна: свёрнутый разговор обязан оставаться слышимым. */}
      <RoomAudioRenderer />
    </LiveKitRoom>
  )
}

/** Как назвать агента в вопросе о согласии: имя из токена, иначе его identity в комнате. */
const agentName = (peers: { name?: string; identity: string }[]): string => {
  const peer = peers.at(0)
  return peer?.name ?? peer?.identity ?? ''
}

/**
 * Удалённое управление внутри комнаты (ADR-0050).
 *
 * <p>Отдельный компонент, потому что хук управления работает с data-каналом и обязан жить внутри
 * провайдера комнаты. Здесь же сходятся обе роли: у обратившегося — вопрос о согласии и красная
 * полоса, у агента — прозрачный слой поверх чужого экрана.
 *
 * <p>Кнопка «Запросить управление» стоит не здесь, а в панели разговора: она нужна агенту рядом
 * с остальными кнопками, а не поверх картинки.
 */
const RemoteControlLayer = ({
  isCaller,
  stageRef,
}: {
  isCaller: boolean
  stageRef: RefObject<HTMLDivElement | null>
}) => {
  const control = useRemoteControlContext()
  const peers = useRemoteParticipants()

  if (isCaller) {
    return (
      <>
        {control.state === 'requested' && (
          <RemoteControlConsent
            agentName={agentName(peers)}
            onDecide={(granted) => {
              if (granted) {
                callSounds.screenOn()
              }
              control.decide(granted)
            }}
          />
        )}
        {control.state === 'active' && (
          <RemoteControlBanner
            onRevoke={() => {
              callSounds.screenOff()
              control.revoke()
            }}
          />
        )}
      </>
    )
  }

  return control.state === 'active' ? (
    <RemoteControlSurface stageRef={stageRef} onAction={control.send} />
  ) : null
}

/** Что происходит с соединением — строкой под заголовком, а не молчанием в чёрном прямоугольнике. */
const RoomStatusLine = () => {
  const { t } = useTranslation()
  const state = useConnectionState()
  const peers = useRemoteParticipants()

  if (state !== ConnectionState.Connected) {
    return t('support.connecting')
  }
  if (peers.length === 0) {
    return t('support.waitingForAgent')
  }
  return peers.map((peer) => peer.name ?? peer.identity).join(', ')
}

/**
 * Сцена разговора.
 *
 * <p><b>Показанный экран занимает её целиком.</b> Ради экрана звонок и затевается: на нём мелкий
 * бухгалтерский текст, суммы и коды счетов, и в трети окна разобрать их невозможно. Плиток
 * участников рядом нет — камеру в этом контуре включить нечем, так что рядом с экраном стояли бы
 * два прямоугольника с именами, а имена и так написаны в шапке окна.
 */
const RoomStage = ({ isCaller }: { isCaller: boolean }) => {
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
            <HeadsetMicIcon sx={{ fontSize: 22, color: '#ffffff' }} />
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
