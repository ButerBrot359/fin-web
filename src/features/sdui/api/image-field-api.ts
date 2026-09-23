import { apiService } from '@/shared/api/api'

// SCRUM-308 v3 §2: фото IMAGE_FIELD. GET требует Authorization: Bearer (все
// эндпоинты под JWT) — обычный <img src> заголовок не пошлёт и получит отказ,
// поэтому blob тянется через API-клиент с интерсептором авторизации.
// GET без фото отвечает 404 — силуэт рисует фронт (см. image-field-node).
export async function fetchImageFieldBlob(sourceUrl: string): Promise<Blob> {
  const res = await apiService.getFileBlob({ url: sourceUrl })
  return res.data
}

export interface ImageUploadResult {
  mediaType: string
  sizeBytes: number
}

// SCRUM-308 v3 §2.4: загрузка — REST multipart (двоичный файл через JSON
// /api/view не передать), поле "file". Ошибки — 400 с ErrorResponse.message,
// текст показывается пользователю как есть.
export async function uploadImageFieldFile(
  uploadUrl: string,
  file: File
): Promise<ImageUploadResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiService.postFormData<ImageUploadResult>({
    url: uploadUrl,
    data: form,
  })
  return res.data
}
