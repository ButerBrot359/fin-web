import { useCallback, useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { VirtualItem } from '@tanstack/react-virtual'

/**
 * С этого числа строк табличная часть рисуется виртуализованно. Ниже порога
 * поведение и разметка остаются прежними (все строки в DOM) — мелкие ТЧ
 * (типичные 1-10 строк) не должны зависеть от измерений и скролл-предка.
 */
const VIRTUALIZE_FROM_ROWS = 50

/** Стартовая оценка высоты строки: 28px контент ячейки + 2px паддинги `td`. */
const ESTIMATED_ROW_HEIGHT = 30

/** Запас строк сверху/снизу окна — при вводе строка не должна уезжать из DOM. */
const OVERSCAN_ROWS = 8

const SCROLLABLE_OVERFLOW = new Set(['auto', 'scroll', 'overlay'])

/**
 * Ближайший предок, который реально прокручивает содержимое по вертикали
 * (в форме документа это `<main>` лэйаута, в боковой панели справочника —
 * её собственный контейнер).
 *
 * Поиск начинаем с РОДИТЕЛЯ обёртки ТЧ: у самой обёртки задан `overflow-x: auto`,
 * из-за чего браузер вычисляет и `overflow-y: auto`, хотя по вертикали она не
 * прокручивается (высота — по содержимому). Если прокручиваемого предка нет —
 * `null`: виртуализацию не включаем и рисуем как раньше (см. `useVirtualTableRows`).
 */
const findScrollParent = (element: HTMLElement): HTMLElement | null => {
  let node = element.parentElement
  while (node && node !== document.body) {
    if (SCROLLABLE_OVERFLOW.has(getComputedStyle(node).overflowY)) return node
    node = node.parentElement
  }
  return null
}

/**
 * Смещение `<tbody>` от начала прокручиваемого содержимого. Инвариантно к самой
 * прокрутке (rect уезжает вверх ровно на то, на сколько растёт scrollTop), меняется
 * только при изменении вёрстки над таблицей — переключение вкладки, ресайз,
 * появление/скрытие полей шапки.
 */
const measureScrollMargin = (
  body: HTMLElement,
  scroller: HTMLElement
): number =>
  body.getBoundingClientRect().top -
  scroller.getBoundingClientRect().top -
  scroller.clientTop +
  scroller.scrollTop

export interface VirtualTableRows {
  /** Виртуализация активна (строк много и найден прокручиваемый предок). */
  isVirtualized: boolean
  /** Окно строк для отрисовки; `null` — рисуем все строки как раньше. */
  virtualItems: VirtualItem[] | null
  /** Высоты строк-распорок вместо неотрисованных строк (держат высоту таблицы). */
  paddingTop: number
  paddingBottom: number
  /** Вешать на обёртку ТЧ (по ней ищем прокручиваемого предка). */
  setContainerRef: (node: HTMLDivElement | null) => void
  /** Вешать на `<tbody>` (по нему считаем смещение и меряем строки). */
  setBodyRef: (node: HTMLTableSectionElement | null) => void
  /** Вешать на `<tr>`: замер реальной высоты строки; `undefined` без виртуализации. */
  measureRow: ((node: HTMLTableRowElement | null) => void) | undefined
  /**
   * Прокрутить окно к строке по абсолютному индексу (поиск по ТЧ: совпадение
   * может быть вне отрисованного окна). Без виртуализации — no-op: строка уже
   * в DOM, потребитель скроллит к ней сам.
   */
  scrollToRow: (index: number) => void
}

/**
 * Виртуализация строк табличной части поверх ВНЕШНЕГО скролла страницы.
 *
 * Обёртка ТЧ прокручивается только по горизонтали, вертикально страницу
 * прокручивает предок — поэтому виртуализатору отдаём найденный скролл-предок и
 * смещение `<tbody>` внутри него (`scrollMargin`). Вёрстка таблицы не меняется:
 * невидимые строки заменяются двумя `<tr>`-распорками, суммарная высота таблицы
 * (а значит и высота страницы, и позиция скроллбара) остаётся прежней.
 */
export const useVirtualTableRows = (rowCount: number): VirtualTableRows => {
  const bodyNodeRef = useRef<HTMLTableSectionElement | null>(null)
  const containerNodeRef = useRef<HTMLDivElement | null>(null)

  // `undefined` — предок ещё не искали (первый рендер): виртуализацию включаем
  // сразу, иначе на открытии формы в DOM успеют смонтироваться все строки — ровно
  // то, от чего уходим. `null` — прокручиваемого предка нет: рисуем всё как раньше.
  const [scroller, setScroller] = useState<HTMLElement | null | undefined>(
    undefined
  )
  const [scrollMargin, setScrollMargin] = useState(0)

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerNodeRef.current = node
    if (node) setScroller(findScrollParent(node))
  }, [])

  const setBodyRef = useCallback((node: HTMLTableSectionElement | null) => {
    bodyNodeRef.current = node
  }, [])

  // Пересчёт смещения держим на колбэках наблюдателей (ResizeObserver отдаёт
  // первый замер сразу после observe, поэтому синхронный вызов в теле эффекта
  // не нужен): вкладка стала видимой, окно поменяло размер, шапка формы выросла.
  useEffect(() => {
    if (!scroller) return

    const remeasure = () => {
      const body = bodyNodeRef.current
      if (!body) return
      const next = measureScrollMargin(body, scroller)
      setScrollMargin((prev) => (Math.abs(prev - next) < 1 ? prev : next))
    }

    const observer = new ResizeObserver(remeasure)
    observer.observe(scroller)
    const container = containerNodeRef.current
    if (container) observer.observe(container)
    // Страховка на случай, когда вёрстка над таблицей сместилась без изменения
    // размеров наблюдаемых узлов: сверяемся при прокрутке (значение инвариантно,
    // поэтому setState почти всегда схлопывается в no-op).
    scroller.addEventListener('scroll', remeasure, { passive: true })

    return () => {
      observer.disconnect()
      scroller.removeEventListener('scroll', remeasure)
    }
  }, [scroller])

  const isVirtualized = rowCount > VIRTUALIZE_FROM_ROWS && scroller !== null

  const virtualizer = useVirtualizer<HTMLElement, HTMLTableRowElement>({
    enabled: isVirtualized,
    count: rowCount,
    getScrollElement: () => scroller ?? null,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN_ROWS,
    scrollMargin,
  })

  const virtualItems = isVirtualized ? virtualizer.getVirtualItems() : null
  const hasWindow = virtualItems !== null && virtualItems.length > 0

  return {
    isVirtualized,
    virtualItems,
    paddingTop: hasWindow
      ? Math.max(0, virtualItems[0].start - scrollMargin)
      : 0,
    paddingBottom: hasWindow
      ? Math.max(
          0,
          virtualizer.getTotalSize() -
            (virtualItems[virtualItems.length - 1].end - scrollMargin)
        )
      : 0,
    setContainerRef,
    setBodyRef,
    measureRow: isVirtualized ? virtualizer.measureElement : undefined,
    scrollToRow: (index: number) => {
      if (isVirtualized) virtualizer.scrollToIndex(index, { align: 'center' })
    },
  }
}
