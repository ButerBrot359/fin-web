import { createContext, use } from 'react'

import type { RemoteControlState } from './use-remote-control'

export interface RemoteControlValue {
  state: RemoteControlState
  request: () => void
  decide: (granted: boolean) => void
  revoke: () => void
  send: (action: {
    action: 'move' | 'click' | 'dblclick' | 'scroll' | 'key'
    x: number
    y: number
    dx?: number
    dy?: number
    key?: string
  }) => void
}

/**
 * Общее состояние удалённого управления на весь разговор (ADR-0050).
 *
 * <p>Контекст, а не проброс через свойства: состояние нужно и кнопке в панели разговора, и слою
 * поверх чужого экрана, и красной полосе наверху — они лежат в разных углах дерева, а машина
 * состояний обязана быть одна. Две копии означали бы «агент считает, что управляет, пока
 * человек считает, что отозвал».
 */
export const RemoteControlContext = createContext<RemoteControlValue | null>(
  null
)

/** Доступ к состоянию управления. Вне провайдера бросает: это ошибка сборки дерева, не рантайма. */
export const useRemoteControlContext = (): RemoteControlValue => {
  const value = use(RemoteControlContext)
  if (!value) {
    throw new Error(
      'useRemoteControlContext вызван вне RemoteControlProvider — управление живёт только внутри комнаты разговора'
    )
  }
  return value
}
