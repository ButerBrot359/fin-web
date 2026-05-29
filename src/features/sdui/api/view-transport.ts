import axios from 'axios'

import type { ViewRequest, ViewResponse, ConflictError } from '../types/view'

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

export class ViewConflictError extends Error {
  constructor(public data: ConflictError) {
    super(data.code)
  }
}

export const viewTransport = {
  post: async (req: ViewRequest): Promise<ViewResponse> => {
    try {
      const res = await instance.post<ViewResponse>('/api/view', req)
      return res.data
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        throw new ViewConflictError(error.response.data as ConflictError)
      }
      if (axios.isAxiosError(error)) {
        throw new Error(
          (error.response?.data as Record<string, unknown>)?.message as string
            ?? error.message,
        )
      }
      throw error
    }
  },

  closeBeacon: (sessionId: string): void => {
    const baseUrl = (import.meta.env.VITE_API_BASE_URL as string) ?? ''
    navigator.sendBeacon(`${baseUrl}/api/view/${sessionId}`, '')
  },
}
