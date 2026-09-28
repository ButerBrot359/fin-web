import { format, parseISO, isValid } from 'date-fns'
import type { Locale } from 'date-fns'
import { ru, kk } from 'date-fns/locale'
import i18n from 'i18next'
import type { SupportedLanguage } from '@/app/config/i18n'

import {
  DISPLAY_DATE_FORMAT,
  DISPLAY_DATETIME_FORMAT,
  DISPLAY_DATETIME_SECONDS_FORMAT,
  DISPLAY_TIME_FORMAT,
} from './iso-date'

const dateFnsLocales: Record<SupportedLanguage, Locale> = {
  ru,
  kz: kk,
}

function getCurrentLocale(): Locale {
  const lang = i18n.language
  if (lang in dateFnsLocales) {
    return dateFnsLocales[lang as SupportedLanguage]
  }
  return ru
}

export function formatDate(
  date: Date | string,
  formatStr = DISPLAY_DATE_FORMAT
): string {
  const parsed = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(parsed)) return ''
  return format(parsed, formatStr, { locale: getCurrentLocale() })
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date, DISPLAY_DATETIME_FORMAT)
}

export function formatDateTimeSeconds(date: Date | string): string {
  return formatDate(date, DISPLAY_DATETIME_SECONDS_FORMAT)
}

export function formatTime(date: Date | string): string {
  return formatDate(date, DISPLAY_TIME_FORMAT)
}

export { parseISO, isValid, format }
