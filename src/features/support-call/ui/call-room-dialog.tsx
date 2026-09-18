import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react'
import '@livekit/components-styles'
import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/utils/cn'

import type { SupportCallSession } from '../model/types'
import { ActiveCallBar } from './active-call-bar'
import { callSounds } from '../lib/call-sounds'
import { STAGE_THEME } from '../lib/stage-theme'
import { RemoteControlProvider } from '../model/remote-control-provider'
import { CallControls } from './call-controls'
import { AgentControlSurface, RemoteControlLayer } from './remote-control-layer'
import { RoomStage } from './room-stage'
import { RoomStatusLine } from './room-status-line'
import { ScreenShareBadge } from './screen-share-badge'
import { SupportDialog } from './support-dialog'

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
        <RemoteControlLayer isCaller={session.role === 'CALLER'} />

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
            subtitle={<RoomStatusLine isCaller={session.role === 'CALLER'} />}
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
              {/* Слой перехвата обязан лежать ВНУТРИ сцены: он позиционируется по ней. */}
              {session.role === 'AGENT' && (
                <AgentControlSurface stageRef={stageRef} />
              )}
            </div>
          </SupportDialog>
        )}
      </RemoteControlProvider>

      {/* Звук участников — вне окна: свёрнутый разговор обязан оставаться слышимым. */}
      <RoomAudioRenderer />
    </LiveKitRoom>
  )
}
