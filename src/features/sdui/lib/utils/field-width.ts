import type { CSSProperties } from 'react'

// SCRUM-355 §5: ширина поля в ЗНАКАХ (widthChars) и подпись слева
// (labelPlacement). В эталоне ширина задаётся знаками — перевод в пиксели
// зависит от шрифта, зума и локали, известных только фронту.

export const widthCharsOf = (
  props: Record<string, unknown> | undefined
): number | undefined => {
  const raw = props?.widthChars
  return typeof raw === 'number' && raw > 0 ? raw : undefined
}

/**
 * Ширину в `ch` получает ВНУТРЕННИЙ <input>, контейнер сжимается по содержимому.
 * maxWidth обязателен рядом с max-content: в ширину содержимого входит и
 * FormHelperText, где у погашенного поля едет длинная причина гашения — без
 * ограничения узкое поле растягивало колонку и уводило страницу в
 * горизонтальную прокрутку. flex '0 1 auto', а не '0 0 auto': расти полю
 * незачем, а сжиматься обязано.
 */
export const WIDTH_CONSTRAINED_SX = {
  width: 'max-content',
  maxWidth: '100%',
  minWidth: 0,
  flex: '0 1 auto',
} as const

/** align: число в эталоне прижато вправо, текст — влево. */
export const widthCharsInputStyle = (
  chars: number,
  align: 'left' | 'right' = 'left'
): CSSProperties => ({ width: `${String(chars)}ch`, textAlign: align })

export const hasLeftLabel = (
  props: Record<string, unknown> | undefined
): boolean => props?.labelPlacement === 'left'
