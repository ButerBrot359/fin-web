import { useLayoutEffect, useRef, type RefObject } from 'react'

import { FIELD_LABEL_ATTR } from '../../ui/nodes/fields/field-label-left'

/** Атрибут хоста, ограничивающий поиск подписей СВОЕЙ группой (SCRUM-355 §8.7). */
export const LABEL_SCOPE_ATTR = 'data-sdui-label-scope'

/**
 * Колонка подписей группы: найти в поддереве подписи левых лейблов
 * ([data-sdui-field-label]), у которых ближайший [data-sdui-label-scope] —
 * сам хост; временно снять minWidth, измерить, максимум записать в
 * CSS-переменную --sdui-label-col на хосте. Так три поля «Кода подтверждения»
 * начинаются с одного x, а вложенные группы меряют только своё.
 */
export function useGroupLabelColumn(): RefObject<HTMLDivElement | null> {
  const hostRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const labels = [
      ...host.querySelectorAll<HTMLElement>(`[${FIELD_LABEL_ATTR}]`),
    ].filter((el) => el.closest(`[${LABEL_SCOPE_ATTR}]`) === host)
    if (labels.length === 0) {
      host.style.removeProperty('--sdui-label-col')
      return
    }
    let max = 0
    for (const el of labels) {
      const prev = el.style.minWidth
      el.style.minWidth = '0'
      max = Math.max(max, el.getBoundingClientRect().width)
      el.style.minWidth = prev
    }
    host.style.setProperty('--sdui-label-col', `${String(Math.ceil(max))}px`)
  })

  return hostRef
}
