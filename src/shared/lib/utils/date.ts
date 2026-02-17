import { format, parseISO, isValid } from 'date-fns'
import type { Locale } from 'date-fns'
import { ru, enUS, kk } from 'date-fns/locale'
import i18n from '@/app/config/i18n'
import type { SupportedLanguage } from '@/app/config/i18n'

const dateFnsLocales: Record<SupportedLanguage, Locale> = {
  ru,
  en: enUS,
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
  formatStr = 'dd.MM.yyyy'
): string {
  const parsed = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(parsed)) return ''
  return format(parsed, formatStr, { locale: getCurrentLocale() })
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date, 'dd.MM.yyyy HH:mm')
}

export { parseISO, isValid, format }
