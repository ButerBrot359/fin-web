import { apiService } from '@/shared/api/api'

import type {
  FaceTemplateSummary,
  FaceTemplateUploadOutcome,
} from '../types/face-template'

const ENROLL_REASON = 'Загружено пользователем из меню учётной записи'
const REVOKE_REASON = 'Удалено пользователем из меню учётной записи'

export const faceTemplatePath = (userId: number) =>
  `/api/admin/users/${String(userId)}/face-template`

export const fetchFaceTemplates = async (
  userId: number
): Promise<FaceTemplateSummary[]> => {
  const { data } = await apiService.get<{ list: FaceTemplateSummary[] }>({
    url: faceTemplatePath(userId),
  })
  return data.list
}

export const fetchFaceTemplateImage = async (
  userId: number,
  templateId: number
): Promise<Blob> => {
  const { data } = await apiService.getFileBlob({
    url: `${faceTemplatePath(userId)}/${String(templateId)}/image`,
  })
  return data
}

export const uploadFaceTemplate = async (
  userId: number,
  file: File
): Promise<FaceTemplateUploadOutcome> => {
  const form = new FormData()
  form.append('file', file)
  form.append('reason', ENROLL_REASON)

  try {
    const { data } = await apiService.postFormData<{
      data: FaceTemplateSummary
    }>({
      url: faceTemplatePath(userId),
      data: form,
    })
    return { kind: 'enrolled', template: data.data }
  } catch (error) {
    return toUploadOutcome(error)
  }
}

export const revokeFaceTemplate = async (
  userId: number,
  templateId: number
): Promise<void> => {
  await apiService.post({
    url: `${faceTemplatePath(userId)}/${String(templateId)}/revoke`,
    data: { reason: REVOKE_REASON },
  })
}

const toUploadOutcome = (error: unknown): FaceTemplateUploadOutcome => {
  const status = readStatus(error)
  switch (status) {
    case 400:
      return { kind: 'badFile' }
    case 409:
      return { kind: 'notAllowed' }
    case 422:
      return { kind: 'badPhoto' }
    case 503:
      return { kind: 'unavailable' }
    default:
      return { kind: 'failed' }
  }
}

const readStatus = (error: unknown): number | null => {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status
    return typeof status === 'number' ? status : null
  }
  return null
}
