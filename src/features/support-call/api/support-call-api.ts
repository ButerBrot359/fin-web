import { apiService } from '@/shared/api/api'

import type {
  SupportCall,
  SupportCallSession,
  SupportCallStartRequest,
} from '../model/types'

const BASE = '/api/support/calls'

/**
 * Живая поддержка (ADR-0050 в webbuh).
 *
 * <b>Токен комнаты выдают только `start` и `join`.</b> В списке обращений его нет и не будет:
 * список видит вся смена поддержки, а токен — это вход в конкретный чужой экран.
 */
export const supportCallApi = {
  /**
   * Позвонить в поддержку.
   *
   * Повторный вызов при незакрытом обращении возвращает ТО ЖЕ обращение со свежим токеном —
   * так работает переподключение после обрыва. Своей логики «создать новое» заводить не нужно.
   */
  start: (data: SupportCallStartRequest) =>
    apiService
      .post<SupportCallSession>({ url: BASE, data })
      .then((response) => response.data),

  /** Взять обращение (поддержка). Право проверяется сервером в момент подключения. */
  join: (callId: number) =>
    apiService
      .post<SupportCallSession>({ url: `${BASE}/${String(callId)}/join` })
      .then((response) => response.data),

  /**
   * Разговор, в котором пользователь уже участвует, — для возврата после перезагрузки.
   * `null`, когда активного разговора нет (сервер отвечает 204 — это штатный ответ).
   */
  active: (signal?: AbortSignal) =>
    apiService
      .get<SupportCallSession | ''>({ url: `${BASE}/active`, signal })
      .then((response) =>
        response.status === 204 ? null : (response.data as SupportCallSession)
      ),

  /** Очередь и текущие разговоры. Ожидающие первыми, по времени звонка. */
  listOpen: (signal?: AbortSignal) =>
    apiService
      .get<SupportCall[]>({ url: BASE, signal })
      .then((response) => response.data),

  /** Завершить обращение. Повторный вызов тоже успешен. */
  end: (callId: number) =>
    apiService.post<never>({ url: `${BASE}/${String(callId)}/end` }),
}
