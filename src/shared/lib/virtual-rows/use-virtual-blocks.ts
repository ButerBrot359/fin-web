import { useCallback, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { VirtualItem } from '@tanstack/react-virtual'

/**
 * С этого числа блоков журнал рисуется виртуализованно. Блок проводки — это
 * обычно 3 строки, порог ~60 строк — сопоставим с порогом построчной
 * виртуализации ТЧ (use-virtual-table-rows, 50 строк).
 */
const VIRTUALIZE_FROM_BLOCKS = 20

/** Стартовая оценка высоты блока: 3 строки по ~33px + разделитель. */
const ESTIMATED_BLOCK_HEIGHT = 105

/**
 * Запас блоков сверху/снизу окна. Заодно поглощает смещение из-за «шапки»
 * таблицы (`<thead>` живёт в том же скролле над блоками и сдвигает их на свою
 * высоту, которую виртуализатор не учитывает — ~120px < высоты одного блока).
 */
const OVERSCAN_BLOCKS = 6

import type { VirtualizationMode } from './use-virtual-table-rows'

export interface VirtualBlocksOptions {
  /** Оценка высоты блока до замера; по умолчанию — блок проводки из 3 строк. */
  estimatedSize?: number
  /** Override с бэка (SCRUM-368 §3.3): ON/OFF — форс, AUTO/отсутствие — порог. */
  mode?: VirtualizationMode
}

export interface VirtualBlocks {
  /** Виртуализация активна (блоков много и контейнер смонтирован). */
  isVirtualized: boolean
  /** Окно блоков для отрисовки; `null` — рисуем все блоки как раньше. */
  virtualItems: VirtualItem[] | null
  /** Высоты распорок вместо неотрисованных блоков (держат высоту скролла). */
  paddingTop: number
  paddingBottom: number
  /** Вешать на прокручиваемый контейнер журнала (`overflow-auto`). */
  setScrollerRef: (node: HTMLDivElement | null) => void
  /** Вешать на корневой элемент блока (`<tbody>`/`<tr>`): замер высоты. */
  measureBlock: ((node: HTMLElement | null) => void) | undefined
}

/**
 * Виртуализация журнала проводок: единица окна — БЛОК проводки (несколько
 * `<tr>` внутри своего `<tbody>` с rowSpan-ячейками), а не отдельная строка —
 * резать блок по строкам нельзя, rowSpan-ячейки живут только в первой.
 *
 * В отличие от use-virtual-table-rows здесь скроллит сам контейнер журнала
 * (`overflow-auto`), поэтому поиск скролл-предка и scrollMargin не нужны.
 * Невидимые блоки заменяются `<tbody>`-распорками, суммарная высота журнала
 * и позиция скроллбара сохраняются.
 */
export const useVirtualBlocks = (
  blockCount: number,
  options?: VirtualBlocksOptions
): VirtualBlocks => {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null)

  const setScrollerRef = useCallback((node: HTMLDivElement | null) => {
    setScroller(node)
  }, [])

  const mode = options?.mode ?? 'AUTO'
  const isVirtualized =
    mode === 'OFF'
      ? false
      : mode === 'ON'
        ? blockCount > 0
        : blockCount > VIRTUALIZE_FROM_BLOCKS
  const estimatedSize = options?.estimatedSize ?? ESTIMATED_BLOCK_HEIGHT

  const virtualizer = useVirtualizer<HTMLDivElement, HTMLElement>({
    enabled: isVirtualized && scroller !== null,
    count: blockCount,
    getScrollElement: () => scroller,
    estimateSize: () => estimatedSize,
    overscan: OVERSCAN_BLOCKS,
  })

  // До монтирования контейнера окно не считаем, но виртуализацию уже включаем:
  // первый рендер большого журнала не должен успеть смонтировать все блоки.
  const active = isVirtualized
  const virtualItems = active
    ? scroller !== null
      ? virtualizer.getVirtualItems()
      : []
    : null
  const hasWindow = virtualItems !== null && virtualItems.length > 0

  return {
    isVirtualized: active,
    virtualItems,
    paddingTop: hasWindow ? virtualItems[0].start : 0,
    paddingBottom: hasWindow
      ? Math.max(
          0,
          virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
        )
      : 0,
    setScrollerRef,
    measureBlock:
      active && scroller !== null ? virtualizer.measureElement : undefined,
  }
}
