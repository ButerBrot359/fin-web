import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import PictureInPictureAltIcon from '@mui/icons-material/PictureInPictureAlt'
import ScreenShareIcon from '@mui/icons-material/ScreenShare'
import TabIcon from '@mui/icons-material/Tab'
import TouchAppIcon from '@mui/icons-material/TouchApp'
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import {
  isTrackReference,
  useRoomContext,
  useTrackToggle,
  useTracks,
} from '@livekit/components-react'
import { Track } from 'livekit-client'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/utils/cn'

import { callSounds } from '../lib/call-sounds'
import { useRemoteControlContext } from '../model/remote-control-context'
import { CallDeviceMenu } from './call-device-menu'

/**
 * Умеет ли браузер предлагать текущую вкладку первой.
 *
 * <p>Только Chromium. Совсем без спроса поделиться нельзя ни в одном браузере — захват экрана
 * всегда требует подтверждения человека, — но с этим флагом в окне выбора остаётся ровно один
 * пункт: сама вкладка. Один щелчок вместо поиска нужного окна среди десятка.
 */
const CAN_PREFER_CURRENT_TAB =
  typeof navigator !== 'undefined' &&
  navigator.userAgent.includes('Chrome') &&
  !navigator.userAgent.includes('Firefox')

/** Умеет ли браузер выносить видео в отдельное окно поверх остальных. */
const CAN_PICTURE_IN_PICTURE =
  typeof document !== 'undefined' && document.pictureInPictureEnabled

/**
 * Кнопка панели разговора.
 *
 * <p>Своя, а не `TrackToggle` из LiveKit: тот приносит собственную тёмную тему и подпись,
 * которая не меняется при переключении — «Выключить микрофон» оставалось на кнопке и после
 * того, как микрофон уже выключен. Поведение берётся из хука, вид — из палитры webbuh.
 */
const ControlButton = ({
  icon,
  label,
  title,
  active,
  danger,
  disabled,
  onClick,
}: {
  icon: ReactNode
  label: string
  /** Подсказка при наведении, когда подписи мало. По умолчанию — сама подпись. */
  title?: string
  /** Действие сейчас включено — кнопка горит фирменным лаймом. */
  active?: boolean
  /** Разрушающее действие: завершить разговор. */
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title ?? label}
    className={cn(
      'flex cursor-pointer items-center gap-2 rounded-md py-2.5 pl-3 pr-4 text-body2 whitespace-nowrap transition-all',
      'disabled:cursor-not-allowed disabled:opacity-60',
      danger
        ? 'bg-support-01 text-white hover:brightness-95'
        : active
          ? 'bg-accent-01 text-ui-06 hover:bg-accent-01-hover'
          : 'bg-ui-02 text-ui-06 hover:bg-ui-04'
    )}
  >
    <span className="flex h-5 w-5 items-center justify-center">{icon}</span>
    {label}
  </button>
)

/**
 * Панель управления разговором (ADR-0050).
 *
 * <p><b>Камеры здесь нет намеренно.</b> Звонок в поддержку — это «послушайте и посмотрите на мой
 * экран», а не видеовстреча: лицо собеседника не помогает найти, почему не проводится документ,
 * зато включённая камера занимает место в сетке и смущает человека, который звонит с рабочего
 * места. Показ экрана остаётся, голос остаётся.
 *
 * <p>Завершение разговора не рвёт соединение здесь, а зовёт {@code onHangUp}: положить трубку —
 * решение человека, и оно должно отличаться от любого другого разрыва соединения.
 */
export const CallControls = ({
  onHangUp,
  isAgent,
}: {
  onHangUp: () => void
  isAgent: boolean
}) => {
  const { t } = useTranslation()
  const control = useRemoteControlContext()

  const mic = useTrackToggle({ source: Track.Source.Microphone })
  const screen = useTrackToggle({ source: Track.Source.ScreenShare })
  const room = useRoomContext()

  // Чужой показанный экран — по нему работает вынос в отдельное окно.
  const peerScreen = useTracks(
    [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: false }
  )
    .filter(isTrackReference)
    .find((track) => !track.participant.isLocal)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ControlButton
        icon={
          mic.enabled ? (
            <MicIcon fontSize="small" />
          ) : (
            <MicOffIcon fontSize="small" />
          )
        }
        label={mic.enabled ? t('support.micOff') : t('support.micOn')}
        active={mic.enabled}
        disabled={mic.pending}
        onClick={() => {
          // Звук берётся по будущему состоянию, а не по текущему: подтверждать надо то,
          // что произойдёт от нажатия, иначе включение микрофона звучало бы выключением.
          if (mic.enabled) {
            callSounds.micOff()
          } else {
            callSounds.micOn()
          }
          void mic.toggle()
        }}
      />

      <ControlButton
        icon={
          screen.enabled ? (
            <StopScreenShareIcon fontSize="small" />
          ) : (
            <ScreenShareIcon fontSize="small" />
          )
        }
        label={screen.enabled ? t('support.screenOff') : t('support.screenOn')}
        active={screen.enabled}
        disabled={screen.pending}
        onClick={() => {
          if (screen.enabled) {
            callSounds.screenOff()
          } else {
            callSounds.screenOn()
          }
          void screen.toggle()
        }}
      />

      {/* Управление просит только поддержка: обратная просьба — от обратившегося к агенту —
          бессмысленна, на экране агента нет бухгалтерии обратившегося. */}
      {isAgent && (
        <ControlButton
          icon={<TouchAppIcon fontSize="small" />}
          label={
            control.state === 'requested'
              ? t('support.controlWaiting')
              : control.state === 'active'
                ? t('support.controlStop')
                : t('support.controlAsk')
          }
          active={control.state === 'active'}
          disabled={control.state === 'requested'}
          onClick={() => {
            if (control.state === 'active') {
              callSounds.screenOff()
              control.revoke()
            } else {
              callSounds.screenOn()
              control.request()
            }
          }}
        />
      )}

      {/* Показ именно этой вкладки. Нужен не только ради удобства: координаты удалённого
          управления пересчитываются в область просмотра страницы, и совпадают они с картинкой
          ровно тогда, когда показана сама вкладка, а не окно или экран целиком. */}
      {!screen.enabled && CAN_PREFER_CURRENT_TAB && (
        <ControlButton
          icon={<TabIcon fontSize="small" />}
          label={t('support.shareThisTab')}
          title={t('support.shareThisTabHint')}
          disabled={screen.pending}
          onClick={() => {
            callSounds.screenOn()
            void room.localParticipant.setScreenShareEnabled(true, {
              preferCurrentTab: true,
              // Переключать показываемую поверхность на ходу нельзя: собеседник целится по
              // картинке, и подмена её под ним означала бы щелчки не туда, куда он смотрит.
              surfaceSwitching: 'exclude',
            })
          }}
        />
      )}

      {/* Экран собеседника поверх остальных окон. Окно разговора живёт внутри вкладки браузера,
          и стоит перейти в другую программу, как его закрывает собой; отдельное окно видно
          всегда — можно смотреть на чужой экран, работая рядом. */}
      {peerScreen && CAN_PICTURE_IN_PICTURE && (
        <ControlButton
          icon={<PictureInPictureAltIcon fontSize="small" />}
          label={t('support.pictureInPicture')}
          title={t('support.pictureInPictureHint')}
          onClick={() => {
            const video = peerScreen.publication.track?.attachedElements.find(
              (element): element is HTMLVideoElement =>
                element instanceof HTMLVideoElement
            )
            void video?.requestPictureInPicture().catch(() => {
              // Браузер отказал (нет жеста, окно уже занято) — молча остаёмся как были.
            })
          }}
        />
      )}

      <CallDeviceMenu />

      <div className="flex-1" />

      <ControlButton
        icon={<CallEndIcon fontSize="small" />}
        label={t('support.leave')}
        danger
        onClick={() => {
          callSounds.hangUp()
          // Сначала объявляем намерение, потом рвём соединение: обработчик разрыва читает
          // именно этот признак, чтобы отличить «положил трубку» от любого другого отключения.
          onHangUp()
          void room.disconnect()
        }}
      />
    </div>
  )
}
