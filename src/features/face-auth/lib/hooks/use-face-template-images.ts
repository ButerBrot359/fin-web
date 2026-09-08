import { useEffect, useState } from 'react'

import { fetchFaceTemplateImage } from '../../api/face-template-endpoints'

export function useFaceTemplateImages(
  userId: number,
  templateIds: number[]
): Record<number, string | undefined> {
  const [urls, setUrls] = useState<Record<number, string | undefined>>({})
  const key = templateIds.join(',')

  useEffect(() => {
    let cancelled = false
    const created: string[] = []

    const load = async () => {
      const entries = await Promise.all(
        templateIds.map(async (templateId) => {
          try {
            const blob = await fetchFaceTemplateImage(userId, templateId)
            const url = URL.createObjectURL(blob)
            created.push(url)
            return [templateId, url] as const
          } catch {
            return null
          }
        })
      )
      if (cancelled) {
        return
      }
      setUrls(Object.fromEntries(entries.filter((entry) => entry !== null)))
    }

    void load()

    return () => {
      cancelled = true
      created.forEach((url) => {
        URL.revokeObjectURL(url)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, key])

  return urls
}
