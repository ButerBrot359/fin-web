import { useRemoteParticipants } from '@livekit/components-react'
import type { RefObject } from 'react'

import { callSounds } from '../lib/call-sounds'
import { useRemoteControlContext } from '../model/remote-control-context'
import { RemoteControlBanner } from './remote-control-banner'
import { RemoteControlConsent } from './remote-control-consent'
import { RemoteControlSurface } from './remote-control-surface'

/** Как назвать агента в вопросе о согласии: имя из токена, иначе его identity в комнате. */
const agentName = (peers: { name?: string; identity: string }[]): string => {
  const peer = peers.at(0)
  return peer?.name ?? peer?.identity ?? ''
}

/**
 * Удалённое управление внутри комнаты (ADR-0050).
 *
 * <p>Только сторона обратившегося: вопрос о согласии и красная полоса. Слой перехвата у агента
 * живёт внутри сцены — см. {@link AgentControlSurface}.
 */
export const RemoteControlLayer = ({ isCaller }: { isCaller: boolean }) => {
  const control = useRemoteControlContext()
  const peers = useRemoteParticipants()

  if (!isCaller) {
    return null
  }

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

/**
 * Слой перехвата у агента.
 *
 * <p>Живёт ВНУТРИ сцены, потому что позиционируется по ней. Раньше висел на уровне комнаты:
 * `absolute inset-0` без опорного контейнера рядом, да ещё и под модальным окном — мышь агента
 * до него не доходила вовсе, и управление выглядело нерабочим.
 */
export const AgentControlSurface = ({
  stageRef,
}: {
  stageRef: RefObject<HTMLDivElement | null>
}) => {
  const control = useRemoteControlContext()
  return control.state === 'active' ? (
    <RemoteControlSurface
      stageRef={stageRef}
      onAction={control.send}
      peerSurface={control.peerSurface}
    />
  ) : null
}
