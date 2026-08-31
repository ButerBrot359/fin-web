import type { ReactNode } from 'react'

import { RemoteControlContext } from './remote-control-context'
import { useRemoteControl } from './use-remote-control'

/**
 * Провайдер состояния удалённого управления (ADR-0050).
 *
 * <p>Стоит ВНУТРИ комнаты LiveKit: под ним работает data-канал, по которому ходят команды.
 */
export const RemoteControlProvider = ({
  isCaller,
  children,
}: {
  isCaller: boolean
  children: ReactNode
}) => {
  const value = useRemoteControl(isCaller)
  return <RemoteControlContext value={value}>{children}</RemoteControlContext>
}
