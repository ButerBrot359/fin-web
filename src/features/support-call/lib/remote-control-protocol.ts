/**
 * Протокол удалённого управления (ADR-0050).
 *
 * <p>Ходит по data-каналу LiveKit — тому же соединению, что и звук с экраном. Отдельного
 * websocket не заводим: у управления и у картинки, которой человек управляет, обязан быть один
 * и тот же путь. Разъехавшиеся каналы означают клики по кадру, которого уже нет.
 *
 * <p><b>Координаты нормированы (0…1), а не в пикселях.</b> У агента и у обратившегося разные
 * экраны, масштабы и плотность точек, и пиксели одного не значат ничего на другом. Доля ширины
 * и высоты переживает и масштабирование видео, и изменение размера окна.
 */

/** Тема сообщений в data-канале. Отделяет управление от всего остального, что там может пойти. */
export const REMOTE_CONTROL_TOPIC = 'webbuh-remote-control'

/** Просьба агента дать управление. Решение принимает только человек за управляемым экраном. */
interface RequestMessage {
  kind: 'request'
}

/** Ответ обратившегося. `granted: false` — отказ, повторная просьба возможна. */
interface DecisionMessage {
  kind: 'decision'
  granted: boolean
}

/** Управление прекращено. Шлёт любая сторона: агент отпустил или человек забрал. */
interface RevokeMessage {
  kind: 'revoke'
}

/**
 * Действие агента.
 *
 * <p>`x` и `y` — доли ширины и высоты области просмотра управляемой страницы.
 */
interface ActionMessage {
  kind: 'action'
  action: 'move' | 'click' | 'dblclick' | 'scroll' | 'key'
  x: number
  y: number
  /** Прокрутка: на сколько точек вниз и вбок. */
  dx?: number
  dy?: number
  /**
   * Клавиша: печатный символ вставляется в поле под курсором, служебная (Enter, Tab, Escape,
   * стрелки, Backspace) отправляется событием. Одна клавиша на сообщение, как у человека, —
   * иначе автодополнение и маски ввода webbuh получают текст, которого пользователь не набирал.
   */
  key?: string
}

export type RemoteControlMessage =
  | RequestMessage
  | DecisionMessage
  | RevokeMessage
  | ActionMessage

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const encodeControl = (message: RemoteControlMessage): Uint8Array =>
  encoder.encode(JSON.stringify(message))

/**
 * Разбирает сообщение из канала.
 *
 * <p>Возвращает `null` на всём, что не разобралось или не похоже на наш формат: в data-канал
 * может прийти что угодно, и падать на чужом сообщении посреди разговора нельзя.
 */
export const decodeControl = (
  payload: Uint8Array
): RemoteControlMessage | null => {
  try {
    const parsed: unknown = JSON.parse(decoder.decode(payload))
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'kind' in parsed &&
      typeof (parsed as { kind: unknown }).kind === 'string'
    ) {
      return parsed as RemoteControlMessage
    }
  } catch {
    // Чужое или битое сообщение — молча пропускаем.
  }
  return null
}

/**
 * Прислал ли это агент поддержки.
 *
 * <p><b>Проверять обязательно.</b> Data-канал видят все участники комнаты, и без проверки
 * отправителя команду управления мог бы прислать кто угодно, кто в ней оказался. Роль зашита в
 * identity сервером при выпуске токена — подделать её участник не может.
 */
export const isFromAgent = (identity: string | undefined): boolean =>
  identity?.startsWith('agent-') ?? false
