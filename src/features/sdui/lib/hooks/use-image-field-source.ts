import { useEffect, useState } from 'react'

import { ApiHttpError } from '@/shared/api/api-error'

import { fetchImageFieldBlob } from '../../api/image-field-api'

// SCRUM-308 v3 §2.3: sourceUrl относительный и под JWT — blob тянется через
// API-клиент, в <img> уходит objectURL (образец — use-face-template-images).
// Версия ?v=<epoch> в sourceUrl меняется при замене фото, эффект перечитывает
// сам. 404 = фото нет — это штатный ответ (серый силуэт), а не ошибка.
export function useImageFieldSource(
  sourceUrl: string | null | undefined
): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (typeof sourceUrl !== 'string' || sourceUrl === '') {
      // Асинхронно, как и успешная ветка: синхронный setState в теле эффекта
      // каскадит рендеры и запрещён линтом.
      let cancelled = false
      queueMicrotask(() => {
        if (!cancelled) setObjectUrl(null)
      })
      return () => {
        cancelled = true
      }
    }

    let cancelled = false
    let created: string | null = null

    const load = async () => {
      try {
        const blob = await fetchImageFieldBlob(sourceUrl)
        if (cancelled) return
        created = URL.createObjectURL(blob)
        setObjectUrl(created)
      } catch (error) {
        if (cancelled) return
        if (!(error instanceof ApiHttpError && error.status === 404)) {
          console.warn('[sdui] image field fetch failed', error)
        }
        setObjectUrl(null)
      }
    }

    void load()

    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [sourceUrl])

  return objectUrl
}
