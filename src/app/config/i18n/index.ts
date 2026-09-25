import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ru from './locales/ru/common.json'
import kz from './locales/kz/common.json'

export const supportedLanguages = ['ru', 'kz'] as const
export type SupportedLanguage = (typeof supportedLanguages)[number]

export const LANGUAGE_STORAGE_KEY = 'i18nextLng'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { common: ru },
      kz: { common: kz },
    },
    defaultNS: 'common',
    fallbackLng: 'ru',
    supportedLngs: supportedLanguages,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  })

export default i18n
