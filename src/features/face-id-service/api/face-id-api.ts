import axios from 'axios'

import { apiService } from '@/shared/api/api'
import { attachClientContextHeaders } from '@/shared/api/attach-client-context-headers'
import type { TokenPair } from '@/shared/types/auth.types'

import type {
  FaceIdAvailability,
  FaceIdPhotoTarget,
  FaceIdSettings,
  FaceIdStart,
  FaceIdUser,
} from '../types/face-id'

// Как и парольный вход: без Bearer и без автоматического refresh/retry на 401.
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

// Вход через Face ID — событие LOGIN: журналу нужен компьютер и адреса (SCRUM-371).
attachClientContextHeaders(publicApi)

export const getFaceIdAvailability = async (): Promise<FaceIdAvailability> => {
  const { data } = await publicApi.get<FaceIdAvailability>(
    '/api/auth/face-id/status'
  )
  return data
}

export const startFaceId = async (
  browserToken: string
): Promise<FaceIdStart> => {
  const { data } = await publicApi.post<FaceIdStart>(
    '/api/auth/face-id/start',
    {
      mode: 'identify',
      browserToken,
    }
  )
  return data
}

export const completeFaceId = async (body: {
  state: string
  code: string
  browserToken: string
}): Promise<TokenPair> => {
  const { data } = await publicApi.post<TokenPair>(
    '/api/auth/face-id/complete',
    body
  )
  return data
}

const photoPath = (target: FaceIdPhotoTarget): string =>
  target.kind === 'self'
    ? '/api/me/face-id'
    : `/api/users/${String(target.userEntryId)}/face-id`

export const getFaceIdProfile = async (
  target: FaceIdPhotoTarget
): Promise<FaceIdUser> => {
  const { data } = await apiService.get<{ data: FaceIdUser }>({
    url: photoPath(target),
  })
  return data.data
}

export const enrollFaceIdProfile = async (
  target: FaceIdPhotoTarget,
  image: string
): Promise<FaceIdUser> => {
  const { data } = await apiService.post<{ data: FaceIdUser }>({
    url: photoPath(target),
    data: { image, consent: true },
    timeout: 45_000,
  })
  return data.data
}

export const replaceFaceIdProfile = async (
  target: FaceIdPhotoTarget,
  image: string,
  expectedProfileId: string
): Promise<FaceIdUser> => {
  const { data } = await apiService.put<{ data: FaceIdUser }>({
    url: photoPath(target),
    data: { image, consent: true, expectedProfileId },
    timeout: 45_000,
  })
  return data.data
}

export const getFaceIdSettings = async (): Promise<FaceIdSettings> => {
  const { data } = await apiService.get<{ data: FaceIdSettings }>({
    url: '/api/admin/face-id-settings',
  })
  return data.data
}

export const updateFaceIdSettings = async (
  enabled: boolean,
  reason: string
): Promise<FaceIdSettings> => {
  const { data } = await apiService.put<{ data: FaceIdSettings }>({
    url: '/api/admin/face-id-settings',
    data: { enabled, reason },
  })
  return data.data
}

export function faceIdHttpStatus(error: unknown): number | undefined {
  if (axios.isAxiosError(error)) return error.response?.status
  if (error && typeof error === 'object' && 'status' in error) {
    return typeof error.status === 'number' ? error.status : undefined
  }
  return undefined
}
