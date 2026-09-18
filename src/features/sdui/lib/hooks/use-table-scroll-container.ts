import { useRef, type RefObject } from 'react'

import {
  HEAVY_ROW_VIRTUAL_OPTIONS,
  useVirtualTableRows,
  type VirtualTableRows,
} from '@/shared/lib/virtual-rows/use-virtual-table-rows'

import type { ViewNode } from '../../types/view'
import { readVirtualization } from '../utils/pagination'
import { useTableViewportMaxHeight } from './use-table-viewport-max-height'

export interface UseTableScrollContainerResult {
  containerRef: RefObject<HTMLDivElement | null>
  virt: VirtualTableRows
  /** maxHeight контейнера по вьюпорту (SCRUM-327); null — без ограничения. */
  maxHeight: number | null
  /**
   * Пол высоты растянутой карточки — см. minHeight в
   * useTableViewportMaxHeight: без него ТЧ схлопывалась до шапки колонок.
   */
  minHeight: number | null
  /** Вешать на TableContainer: один узел для ref, вьюпорта и виртуализации. */
  setContainerRef: (node: HTMLDivElement | null) => void
}

/**
 * Скролл-контейнер ТЧ, общий для обеих редактируемых таблиц.
 *
 * Виртуализация строк (SCRUM-368): в DOM — только видимое окно видимого
 * набора. Ниже порога хука рендер прежний (все строки).
 *
 * SCRUM-327: вертикальный скролл живёт внутри ТЧ (maxHeight по вьюпорту),
 * страница документа не растягивается; окно виртуализации — от контейнера.
 */
export function useTableScrollContainer(
  node: ViewNode,
  rowCount: number
): UseTableScrollContainerResult {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const virt = useVirtualTableRows(
    rowCount,
    readVirtualization(node),
    HEAVY_ROW_VIRTUAL_OPTIONS
  )
  const viewport = useTableViewportMaxHeight()
  const setContainerRef = (node: HTMLDivElement | null) => {
    containerRef.current = node
    viewport.setNode(node)
    virt.setContainerRef(node)
  }
  return {
    containerRef,
    virt,
    maxHeight: viewport.maxHeight,
    minHeight: viewport.minHeight,
    setContainerRef,
  }
}
