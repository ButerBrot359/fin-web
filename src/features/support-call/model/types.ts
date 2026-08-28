/**
 * Контракт живой поддержки (ADR-0050 в репозитории webbuh).
 *
 * Источник — `docs/project/frontend-handoff-zhivaya-podderzhka.md`. Поля названы ровно так,
 * как их отдаёт сервер: расхождение имён между слоями ловится только в рантайме.
 */

/** Состояние обращения. Переход только вперёд: WAITING → ACTIVE → ENDED. */
export type SupportCallStatus = 'WAITING' | 'ACTIVE' | 'ENDED'

/** Роль в комнате. Назначает СЕРВЕР — клиент её только отображает. */
export type SupportParticipantRole = 'CALLER' | 'AGENT'

/** Чем поддержка видит происходящее: голос, совместный просмотр или показ экрана. */
export type SupportShareMode = 'NONE' | 'CO_BROWSE' | 'SCREEN'

/** Тело `POST /api/support/calls`. */
export interface SupportCallStartRequest {
  /** Короткое описание проблемы со слов пользователя. Видно поддержке в очереди. */
  subject?: string
  /**
   * Согласие на запись разговора и показа экрана. Без него сервер отвечает 400, когда
   * запись включена: в кадр попадают персональные данные и суммы.
   */
  recordingConsent: boolean
  /** Раздел, из которого позвонили. Половина обращений понятна уже по нему. */
  page?: string
}

/** Всё, что нужно для подключения к комнате. Возвращается и звонящему, и агенту. */
export interface SupportCallSession {
  callId: number
  roomName: string
  /**
   * Токен LiveKit. Живёт минуты — ровно чтобы успеть подключиться. НЕ кэшировать и не
   * класть в хранилище браузера: он даёт вход в конкретную комнату.
   */
  accessToken: string
  accessTokenExpiresInSeconds: number
  /** Адрес SFU (`wss://…`). Приходит с сервера, чтобы не зашивать его в сборку. */
  serverUrl: string
  identity: string
  role: SupportParticipantRole
  /** Ведётся ли запись. Показывать пользователю ВЕСЬ разговор, а не только при согласии. */
  recording: boolean
}

/** Карточка обращения для очереди и истории. Токена здесь нет и не будет. */
export interface SupportCall {
  id: number
  status: SupportCallStatus
  callerLogin: string
  agentLogin: string | null
  subject: string | null
  page: string | null
  shareMode: SupportShareMode
  startedAt: string
  answeredAt: string | null
  endedAt: string | null
  recordingConsent: boolean
  recordingUrl: string | null
}
