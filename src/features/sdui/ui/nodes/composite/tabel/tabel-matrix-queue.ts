import { useRef, useState } from 'react'

import { useSduiDispatch } from '../../../../lib/dispatch'
import { useSduiSession } from '../../../../lib/sdui-session-context'
import {
  parseTabelMatrixPayload,
  type TabelMatrixCommand,
  type TabelMatrixPayload,
} from './tabel-matrix-contract'

/**
 * Билдер команды: вызывается В ГОЛОВЕ очереди, когда патчи предыдущей мутации
 * уже применены. Получает АКТУАЛЬНЫЙ payload — его generation и есть валидный
 * baseGeneration (правило конкурентности spec v1 §4). Вернуть null — отменить
 * команду (цель исчезла после чужого обновления).
 */
export type TabelCommandBuilder = (
  payload: TabelMatrixPayload
) => Omit<TabelMatrixCommand, 'baseGeneration'> | TabelMatrixCommand | null

export interface TabelMatrixQueue {
  /** Поставить мутацию в очередь. Промис решается после ответа сервера. */
  enqueue: (build: TabelCommandBuilder) => Promise<boolean>
  /** true, пока хотя бы одна мутация в transport или в очереди. */
  busy: boolean
}

/**
 * Сериализатор матричных мутаций (spec v1 §4): не более одной команды в
 * transport одновременно; последующие ждут; команда собирается только после
 * применения патчей предыдущей; авто-replay после ошибки запрещён (ошибочная
 * команда просто завершает свой промис false, очередь продолжает).
 */
export function useTabelMatrixQueue(
  nodeId: string,
  binding: string
): TabelMatrixQueue {
  const dispatch = useSduiDispatch()
  const session = useSduiSession()
  const [busy, setBusy] = useState(false)
  const chainRef = useRef<Promise<void>>(Promise.resolve())
  const pendingRef = useRef(0)

  const enqueue = (build: TabelCommandBuilder) => {
    pendingRef.current += 1
    setBusy(true)

    let resolveResult: (ok: boolean) => void = () => undefined
    const result = new Promise<boolean>((resolve) => {
      resolveResult = resolve
    })

    const run = async () => {
      try {
        // Читаем payload в момент отправки, не в момент клика: предыдущие
        // мутации уже заменили значение binding авторитетным ответом.
        const payload = parseTabelMatrixPayload(session.getValue(binding))
        if (!payload) {
          resolveResult(false)
          return
        }
        const command = build(payload)
        if (!command) {
          resolveResult(false)
          return
        }
        const ok = await dispatch({
          type: 'EVENT',
          sourceNodeId: `${nodeId}.matrix`,
          trigger: 'change',
          value: { ...command, baseGeneration: payload.generation },
        })
        resolveResult(ok)
      } catch {
        // Ошибку transport уже показал dispatch; очередь не рвём.
        resolveResult(false)
      } finally {
        pendingRef.current -= 1
        if (pendingRef.current === 0) setBusy(false)
      }
    }

    chainRef.current = chainRef.current.then(run)
    return result
  }

  return { enqueue, busy }
}
