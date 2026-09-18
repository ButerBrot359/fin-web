import {
  useConnectionState,
  useRemoteParticipants,
} from '@livekit/components-react'
import { ConnectionState } from 'livekit-client'
import { useTranslation } from 'react-i18next'

/** Что происходит с соединением — строкой под заголовком, а не молчанием в чёрном прямоугольнике. */
export const RoomStatusLine = ({ isCaller }: { isCaller: boolean }) => {
  const { t } = useTranslation()
  const state = useConnectionState()
  const peers = useRemoteParticipants()

  if (state !== ConnectionState.Connected) {
    return t('support.connecting')
  }
  if (peers.length === 0) {
    // Роль решает так же, как на сцене: агенту не может «отвечать поддержка» — он ею и является,
    // и если он остался один, значит собеседник ушёл.
    return t(isCaller ? 'support.waitingForAgent' : 'support.peerLeft')
  }
  return peers.map((peer) => peer.name ?? peer.identity).join(', ')
}
