import { useDataChannel, useRoomContext } from '@livekit/components-react'
import { Track } from 'livekit-client'
import { useCallback, useRef, useState } from 'react'

import { applyClick, applyKey, applyScroll } from '../lib/remote-control-apply'
import { applyMove, hideRemoteCursor } from '../lib/remote-cursor'
import type { RemoteControlMessage } from '../lib/remote-control-protocol'
import {
  REMOTE_CONTROL_TOPIC,
  decodeControl,
  encodeControl,
  isFromAgent,
} from '../lib/remote-control-protocol'

/**
 * Состояние управления.
 *
 * <p>`requested` живёт по разные стороны по-разному: у агента это «жду ответа», у обратившегося —
 * «меня спрашивают». Общая машина состояний на обе роли выбрана намеренно: рассинхрон между
 * «агент думает, что управляет» и «человек думает, что не разрешал» — худшее, что здесь может
 * случиться.
 */
export type RemoteControlState = 'idle' | 'requested' | 'active' | 'denied'

interface UseRemoteControl {
  state: RemoteControlState
  /** Что показывает собеседник: `browser` — вкладку. Известно агенту после согласия. */
  peerSurface: string | null
  /** Агент: попросить управление. */
  request: () => void
  /** Обратившийся: ответить на просьбу. */
  decide: (granted: boolean) => void
  /** Любая сторона: прекратить. */
  revoke: () => void
  /** Агент: отправить действие. Молчит, пока управление не разрешено. */
  send: (
    action: Omit<Extract<RemoteControlMessage, { kind: 'action' }>, 'kind'>
  ) => void
}

/**
 * Удалённое управление экраном (ADR-0050).
 *
 * <p><b>Разрешение даёт только человек и только на один раз.</b> Согласие не сохраняется, не
 * переносится на следующий звонок и отзывается мгновенно: за экраном бухгалтера госучреждения
 * платёжки, зарплаты и проведение документов, и любое «разрешил однажды — значит навсегда» тут
 * недопустимо.
 *
 * <p><b>Команды исполняются, только пока состояние `active`.</b> Проверка стоит на принимающей
 * стороне, а не на отправляющей: доверять чужому клиенту в вопросе «а мне уже можно» нельзя.
 * Дополнительно проверяется отправитель — команды принимаются только от агента.
 *
 * @param isCaller эта сторона — управляемая; агент отправляет, обратившийся исполняет
 */
export const useRemoteControl = (isCaller: boolean): UseRemoteControl => {
  const [state, setState] = useState<RemoteControlState>('idle')
  const [peerSurface, setPeerSurface] = useState<string | null>(null)
  const room = useRoomContext()

  // Состояние читается внутри обработчика сообщений, который живёт дольше рендера: без ссылки
  // он видел бы состояние на момент подписки и исполнял бы команды после отзыва управления.
  const stateRef = useRef<RemoteControlState>('idle')
  const move = (next: RemoteControlState) => {
    stateRef.current = next
    setState(next)
    if (next !== 'active') {
      // Курсор агента обязан исчезнуть вместе с правом управлять: чужая стрелка на экране
      // после отзыва означала бы, что за тобой всё ещё следят.
      hideRemoteCursor()
    }
  }

  // Единственный useCallback хука — и он обязателен: идентичность обработчика управляет
  // переподпиской useDataChannel, и новый колбэк на каждый рендер означал бы переподписку
  // на каждый рендер. Остальные функции хука уходят потребителям через контекст, чьё
  // значение и так пересобирается каждый рендер, — стабильность им ничего не даёт.
  const handle = useCallback(
    (message: { payload: Uint8Array; from?: { identity: string } }) => {
      const parsed = decodeControl(message.payload)
      if (!parsed) {
        return
      }
      const fromAgent = isFromAgent(message.from?.identity)

      switch (parsed.kind) {
        case 'request':
          // Спрашивать может только агент и только управляемую сторону.
          if (isCaller && fromAgent) {
            move('requested')
          }
          return

        case 'decision':
          if (!isCaller) {
            setPeerSurface(parsed.surface ?? null)
            move(parsed.granted ? 'active' : 'denied')
          }
          return

        case 'revoke':
          move('idle')
          return

        case 'action': {
          // Ключевая проверка: исполняем, только пока управление действительно разрешено
          // ЭТОЙ стороной, и только команды агента.
          if (!isCaller || stateRef.current !== 'active' || !fromAgent) {
            return
          }
          const at = { x: parsed.x, y: parsed.y }
          switch (parsed.action) {
            case 'move':
              applyMove(at)
              return
            case 'click':
              applyClick(at)
              return
            case 'dblclick':
              applyClick(at, true)
              return
            case 'scroll':
              applyScroll(at, parsed.dx ?? 0, parsed.dy ?? 0)
              return
            case 'key':
              applyKey(at, parsed.key ?? '')
              return
          }
        }
      }
    },
    [isCaller]
  )

  const { send: sendRaw } = useDataChannel(REMOTE_CONTROL_TOPIC, handle)

  /**
   * Отправка сообщения.
   *
   * <p><b>Всегда по надёжному каналу.</b> Движения курсора сперва шли по ненадёжному — их много,
   * и потерянный кадр движения ничего не значит. Но LiveKit роняет этот канал сам
   * (`DATA_TRACK_LOSSY closed unexpectedly`), и вместе с ним молча пропадали ВСЕ движения:
   * со стороны это выглядело как «управление не работает, мышь не двигается». Экономия
   * ненадёжного канала не стоит механизма, который перестаёт работать без единой ошибки.
   * Частоту ограничивает отправитель — см. поверхность перехвата.
   */
  const post = (message: RemoteControlMessage) => {
    void sendRaw(encodeControl(message), {
      reliable: true,
      topic: REMOTE_CONTROL_TOPIC,
    })
  }

  const request = () => {
    move('requested')
    post({ kind: 'request' })
  }

  const decide = (granted: boolean) => {
    move(granted ? 'active' : 'idle')
    // Тип показываемой поверхности берём из собственного трека: только сама вкладка даёт
    // точное совпадение картинки у агента с областью просмотра здесь.
    const share = room.localParticipant.getTrackPublication(
      Track.Source.ScreenShare
    )
    const surface = share?.track?.mediaStreamTrack.getSettings().displaySurface
    post({ kind: 'decision', granted, surface })
  }

  const revoke = () => {
    move('idle')
    post({ kind: 'revoke' })
  }

  const send = (
    action: Omit<Extract<RemoteControlMessage, { kind: 'action' }>, 'kind'>
  ) => {
    if (stateRef.current !== 'active') {
      return
    }
    post({ kind: 'action', ...action })
  }

  return { state, peerSurface, request, decide, revoke, send }
}
