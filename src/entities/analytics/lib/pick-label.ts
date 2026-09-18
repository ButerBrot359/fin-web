/**
 * Выбор подписи по языку интерфейса — одно правило на весь раздел аналитики:
 * таблицы, графики, экспорт и поля параметров берут его отсюда.
 */

/** Язык подписей: 'kz'/'kk' включает казахские варианты (labelKz/titleKz). */
export const isKazakh = (lang?: string | null): boolean => {
  const normalized = (lang ?? '').toLowerCase()
  return normalized.startsWith('kz') || normalized.startsWith('kk')
}

interface LabelSource {
  label?: string | null
  labelKz?: string | null
}

interface TitleSource {
  title?: string | null
  titleKz?: string | null
}

/** Подпись поля/колонки с учётом языка интерфейса. */
export const pickLabel = (
  source: LabelSource | null | undefined,
  fallback: string,
  lang?: string | null
): string => {
  if (!source) return fallback
  const preferred = isKazakh(lang) ? source.labelKz : source.label
  return preferred ?? source.label ?? fallback
}

/** Заголовок виджета/спецификации с учётом языка интерфейса. */
export const pickTitle = (
  source: TitleSource | null | undefined,
  lang?: string | null
): string => {
  if (!source) return ''
  const preferred = isKazakh(lang) ? source.titleKz : source.title
  return preferred ?? source.title ?? ''
}
