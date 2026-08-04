import axios from 'axios'
import i18n from 'i18next'

import type { ViewRequest, ViewResponse, ConflictError } from '../types/view'
import { normalizeConflictBody } from './normalize-conflict'
import { parseViewError } from './parse-view-error'
import { resolveViewLanguage } from './view-language'

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

export class ViewConflictError extends Error {
  constructor(public data: ConflictError) {
    super(data.code)
  }
}

export class ViewHttpError extends Error {
  constructor(
    message: string,
    public status: number | undefined,
    public code?: string,
    public kind?: string
  ) {
    super(message)
  }
}

export const viewTransport = {
  post: async (req: ViewRequest): Promise<ViewResponse> => {
    try {
      const res = await instance.post<ViewResponse>('/api/view', {
        ...req,
        language: resolveViewLanguage(i18n.language),
      })
      return res.data
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        throw new ViewConflictError(normalizeConflictBody(error.response.data))
      }
      if (axios.isAxiosError(error)) {
        const meta = parseViewError(error.response?.data)
        throw new ViewHttpError(
          meta.message ?? error.message,
          error.response?.status,
          meta.code,
          meta.kind
        )
      }
      throw error
    }
  },

  // Продление form-session долгоживущих форм (карточка справочника) — §2.2
  // спеки SCRUM-244. true = сессия жива, false = 404 (нужно переоткрытие).
  // Прочие ошибки (сеть, 5xx) не считаем смертью сессии — пинг продолжается.
  heartbeat: async (sessionId: string): Promise<boolean> => {
    try {
      await instance.post(`/api/view/${sessionId}/heartbeat`)
      return true
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404)
        return false
      return true
    }
  },

  closeBeacon: (sessionId: string): void => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL
    navigator.sendBeacon(`${baseUrl}/api/view/${sessionId}`, '')
  },
}
