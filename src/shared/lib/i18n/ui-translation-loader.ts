import axios from 'axios'
import i18next from 'i18next'

import { localizeDeep, setUiDictionary } from './ui-translation'

export const UI_TRANSLATIONS_URL = '/api/ui-translations'

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

let dictionaryRequest: Promise<void> | null = null

export const ensureUiTranslations = (): Promise<void> => {
  dictionaryRequest ??= axios
    .get<{ data?: Record<string, string> }>(UI_TRANSLATIONS_URL, {
      baseURL: import.meta.env.VITE_API_BASE_URL,
    })
    .then((response) => {
      applyUiDictionary(response.data.data ?? {})
    })
    .catch(() => {
      dictionaryRequest = null
    })
  return dictionaryRequest
}
