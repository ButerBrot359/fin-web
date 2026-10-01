import { useRef, useState } from 'react'

import type { ViewAction } from '../../types/view'
import { useSduiDispatch } from '../dispatch'
import { useSduiSession } from '../sdui-session-context'

/**
 * Семантический payload вычисляемого TABLE-узла с compare-and-set токеном
 * сервера: матрица Табеля (`tabel-matrix/v1`), сетка регламентированного
 * отчёта (`report-sheet/v1`). generation — серверная ревизия, не browser.
 */
export interface GenerationPayload {
  generation: number
}

/**
 * Билдер команды: вызывается В ГОЛОВЕ очереди, когда патчи предыдущей мутации
 * уже применены, и получает АКТУАЛЬНЫЙ payload — его generation и есть
 * валидный baseGeneration. Вернуть null — отменить команду (цель исчезла
 * после чужого обновления).
 */
export type GenerationCommandBuilder<P, C> = (payload: P) => C | null

export interface GenerationCommandQueue<P, C> {
  /** Поставить мутацию в очередь. Промис решается после ответа сервера. */
  enqueue: (build: GenerationCommandBuilder<P, C>) => Promise<boolean>
  /** true, пока хотя бы одна мутация в transport или в очереди. */
  busy: boolean
  /** true, если generation порождена мутацией этой очереди. Чужая generation
   * означает замену payload серверной командой формы («Заполнить» и т.п.). */
  isOwnGeneration: (generation: number) => boolean
}

export interface GenerationCommandQueueOptions<P> {
  /** sourceNodeId EVENT-а — адрес, который сервер слушает для команд узла. */
  sourceNodeId: string
  /** binding, под которым лежит payload (его заменяет патч ответа целиком). */
  binding: string
  /** Разбор payload с провода; null — битая форма, команда не шлётся. */
  parse: (value: unknown) => P | null
}

const OWN_GENERATIONS_LIMIT = 100

/**
 * EVENT change с командой узла: baseGeneration всегда из payload, прочитанного
 * в момент отправки (правило конкурентности tabel-matrix/v1 §4, report-sheet/v1).
 */
export function buildGenerationEvent(
  sourceNodeId: string,
  command: object,
  generation: number
): ViewAction {
  return {
    type: 'EVENT',
    sourceNodeId,
    trigger: 'change',
    value: { ...command, baseGeneration: generation },
  }
}

/**
 * Сериализатор мутаций generation-узла (выделен из очереди матрицы Табеля,
 * spec v1 §4): не более одной команды в transport одновременно; последующие
 * ждут; команда собирается только после применения патчей предыдущей;
 * авто-replay после ошибки запрещён (ошибочная команда просто завершает свой
 * промис false, очередь продолжает).
 */
export function useGenerationCommandQueue<
  P extends GenerationPayload,
  C extends object,
>({
  sourceNodeId,
  binding,
  parse,
}: GenerationCommandQueueOptions<P>): GenerationCommandQueue<P, C> {
  const dispatch = useSduiDispatch()
  const session = useSduiSession()
  const [busy, setBusy] = useState(false)
  const chainRef = useRef<Promise<void>>(Promise.resolve())
  const pendingRef = useRef(0)
  const ownGenerationsRef = useRef<Set<number>>(new Set())

  const enqueue = (build: GenerationCommandBuilder<P, C>) => {
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
        const payload = parse(session.getValue(binding))
        if (!payload) {
          resolveResult(false)
          return
        }
        const command = build(payload)
        if (!command) {
          resolveResult(false)
          return
        }
        const ok = await dispatch(
          buildGenerationEvent(sourceNodeId, command, payload.generation)
        )
        if (ok) {
          // Ответ уже применил патчи — читаем свежую generation и помечаем
          // её «своей» (bounded-набор, чтобы не расти бесконечно).
          const next = parse(session.getValue(binding))
          if (next) {
            const own = ownGenerationsRef.current
            own.add(next.generation)
            if (own.size > OWN_GENERATIONS_LIMIT) {
              own.delete(own.values().next().value!)
            }
          }
        }
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

  return {
    enqueue,
    busy,
    // pendingRef в условии закрывает гонку: патчи ответа применяются ДО того,
    // как очередь успевает пометить свежую generation, и эффект таблицы может
    // сработать в этом окне. Пока есть in-flight мутации, обновление своё
    // (чужие команды при живой очереди невозможны — in-flight-гард сессии).
    isOwnGeneration: (generation) =>
      ownGenerationsRef.current.has(generation) || pendingRef.current > 0,
  }
}
