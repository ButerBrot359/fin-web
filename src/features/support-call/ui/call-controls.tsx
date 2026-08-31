import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare'
import TouchAppIcon from '@mui/icons-material/TouchApp'
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import { useRoomContext, useTrackToggle } from '@livekit/components-react'
import { Track } from 'livekit-client'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/utils/cn'

import { callSounds } from '../lib/call-sounds'
import { useRemoteControlContext } from '../model/remote-control-context'
import { CallDeviceMenu } from './call-device-menu'

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
  active,
  danger,
  disabled,
  onClick,
}: {
  icon: ReactNode
  label: string
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
    title={label}
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
