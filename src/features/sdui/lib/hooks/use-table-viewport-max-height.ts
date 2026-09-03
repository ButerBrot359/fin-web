import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * SCRUM-327: скролл ТЧ живёт внутри самой таблицы, а не на странице документа.
 * Хук вычисляет доступную высоту контейнера ТЧ: от его верхней кромки до низа
 * вьюпорта минус запас под подвал формы (комментарий/ответственный). Дальше
 * контейнер получает maxHeight + overflowY:auto, и виртуализация строк
 * (SCRUM-368) переключается на него как на скролл-предок (data-own-scroll).
 */

/** Запас под подвал формы и отступы; подвал generic-формы не замеряем. */
const BOTTOM_RESERVE_PX = 148

/**
 * Растянутая карточка (PAGE тянется по высоте, лента вкладок помечена
 * data-stretch) высоту ТЧ задаёт САМА, через flex: контейнер упирается в подвал,
 * прижатый к нижней кромке. Замер по вьюпорту там лишний — он вычитает
 * BOTTOM_RESERVE_PX ещё раз и оставляет между таблицей и подвалом дыру в
 * высоту этого запаса.
 */
const findStretchedAncestor = (element: HTMLElement): HTMLElement | null => {
  let node = element.parentElement
  while (node && node !== document.body) {
    if (node.dataset.stretch === 'true') return node
    node = node.parentElement
  }
  return null
}

/** Ниже этой высоты ТЧ не сжимаем: при очень длинной шапке появится
 * второй скролл страницы, но таблица останется пригодной для работы. */
const MIN_HEIGHT_PX = 240

const SCROLLABLE_OVERFLOW = new Set(['auto', 'scroll', 'overlay'])

/** Прокручиваемый предок страницы (в форме документа — `<main>` лэйаута). */
const findPageScroller = (element: HTMLElement): HTMLElement | null => {
  let node = element.parentElement
  while (node && node !== document.body) {
    if (SCROLLABLE_OVERFLOW.has(getComputedStyle(node).overflowY)) return node
    node = node.parentElement
  }
  return null
}

export interface TableViewportMaxHeight {
  /** px или null, пока контейнер не смонтирован/не замерен. */
  maxHeight: number | null
  /** Повесить на контейнер ТЧ (совместим с другими ref-колбэками). */
  setNode: (node: HTMLElement | null) => void
}

export function useTableViewportMaxHeight(): TableViewportMaxHeight {
  const nodeRef = useRef<HTMLElement | null>(null)
  const [maxHeight, setMaxHeight] = useState<number | null>(null)

  const setNode = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node
  }, [])

  useEffect(() => {
    const measure = () => {
      const node = nodeRef.current
      if (!node) return
      if (findStretchedAncestor(node)) {
        setMaxHeight(null)
        return
      }
      const scroller = findPageScroller(node)
      // Верх контейнера в системе координат прокрутки страницы: инвариантен к
      // текущему scrollTop (как measureScrollMargin в use-virtual-table-rows).
      const top = scroller
        ? node.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop
        : node.getBoundingClientRect().top + window.scrollY
      const viewportH = scroller ? scroller.clientHeight : window.innerHeight
      const next = Math.max(
        MIN_HEIGHT_PX,
        Math.floor(viewportH - top - BOTTOM_RESERVE_PX)
      )
      setMaxHeight((prev) => (prev === next ? prev : next))
    }

    measure()
    const node = nodeRef.current
    const scroller = node ? findPageScroller(node) : null
    // jsdom в юнит-тестах ResizeObserver не даёт — там достаточно resize окна.
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (observer) {
      if (scroller) observer.observe(scroller)
      if (node?.parentElement) observer.observe(node.parentElement)
    }
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return { maxHeight, setNode }
}
