import axios from 'axios'
import i18next from 'i18next'

import {
  getStorageItem,
  setStorageItem,
} from '@/shared/lib/utils/local-storage'

import { localizeDeep, setUiDictionary } from './ui-translation'

export const UI_TRANSLATIONS_URL = '/api/ui-translations'
export const UI_TRANSLATIONS_STORAGE_KEY = 'ui-translations'

interface CachedDictionary {
  etag?: string
  data: Record<string, string>
}

export const applyUiDictionary = (dictionary: Record<string, string>) => {
  setUiDictionary(dictionary)
  const ru: unknown = i18next.getResourceBundle('ru', 'common')
  if (ru) {
    i18next.addResourceBundle(
      'kz',
      'common',
      localizeDeep(ru, 'kz'),
      false,
      true
    )
  }
}

const readCachedDictionary = (): CachedDictionary | null => {
  const cached = getStorageItem<Partial<CachedDictionary> | null>(
    UI_TRANSLATIONS_STORAGE_KEY,
    null
  )
  return cached?.data ? { etag: cached.etag, data: cached.data } : null
}

const writeCachedDictionary = (cached: CachedDictionary) => {
  try {
    setStorageItem(UI_TRANSLATIONS_STORAGE_KEY, cached)
  } catch {
    return
  }
}

let dictionaryReady: Promise<void> | null = null

export const ensureUiTranslations = (): Promise<void> => {
  if (dictionaryReady) return dictionaryReady
  const cached = readCachedDictionary()
  if (cached) applyUiDictionary(cached.data)
  const request = axios
    .get<{ data?: Record<string, string> }>(UI_TRANSLATIONS_URL, {
      baseURL: import.meta.env.VITE_API_BASE_URL,
      headers: cached?.etag ? { 'If-None-Match': cached.etag } : undefined,
      validateStatus: (status) => status === 200 || status === 304,
    })
    .then((response) => {
      if (response.status === 304) return
      const data = response.data.data ?? {}
      applyUiDictionary(data)
      const etag: unknown = response.headers.etag
      writeCachedDictionary({
        etag: typeof etag === 'string' ? etag : undefined,
        data,
      })
    })
    .catch(() => {
      dictionaryReady = null
    })
  dictionaryReady = cached ? Promise.resolve() : request
  return dictionaryReady
}
