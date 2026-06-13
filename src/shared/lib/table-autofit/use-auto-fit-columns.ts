import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import type { ColumnSizingState, OnChangeFn } from '@tanstack/react-table'

/**
 * Логический подбор ширины колонок «на всю страницу» при первом открытии.
 *
 * Каждой колонке задаётся «вес» (узкие поля — код/число/дата — маленький вес,
 * наименования — большой). Доступная ширина контейнера распределяется между
 * колонками пропорционально весам, поэтому таблица занимает всю ширину страницы
 * без горизонтальной прокрутки, а узкие поля не растягиваются зря.
 *
 * После первого подбора ширины фиксируются — колонки можно тянуть мышью
 * (ресайз идёт через тот же `columnSizing`).
 *
 * @param weights  карта `columnId -> вес` (вес <= 0 трактуется как 1)
 * @param reserve  запас по ширине (разрядка ячеек/скроллбар), вычитается
 */
export const useAutoFitColumns = (
  containerRef: RefObject<HTMLElement | null>,
  ready: boolean,
  weights: Record<string, number>,
  reserve = 0
) => {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const doneRef = useRef(false)

  useLayoutEffect(() => {
    if (doneRef.current || !ready) return
    const el = containerRef.current
    if (!el) return
    const avail = el.clientWidth - reserve
    if (avail <= 0) return

    const entries = Object.entries(weights)
    if (entries.length === 0) return
    const sumW = entries.reduce((acc, [, w]) => acc + (w > 0 ? w : 1), 0)
    if (sumW <= 0) return

    const sizing: ColumnSizingState = {}
    for (const [id, w] of entries) {
      sizing[id] = Math.max(56, Math.round(((w > 0 ? w : 1) / sumW) * avail))
    }

    doneRef.current = true
    // Замер DOM → фиксация ширин (выполняется один раз до отрисовки).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColumnSizing(sizing)
  }, [containerRef, ready, weights, reserve])

  const onColumnSizingChange: OnChangeFn<ColumnSizingState> = useCallback(
    (updater) => {
      setColumnSizing((prev) =>
        typeof updater === 'function' ? updater(prev) : updater
      )
    },
    []
  )

  return { columnSizing, onColumnSizingChange }
}

/**
 * Подбор ширины колонок ПО СОДЕРЖИМОМУ (как в исходном auto-layout): таблица
 * сначала рендерится в `auto`-режиме (колонки под контент + заголовок), затем
 * замеренные ширины фиксируются — после этого колонки можно тянуть мышью.
 *
 * Ширины НЕ масштабируются под страницу: каждое поле получает столько, сколько
 * нужно его содержимому (узкие — коды/числа, широкие — наименования), как в
 * привычном отображении регистров. Заголовки должны иметь `data-autofit-col`.
 *
 * Пока ширины не зафиксированы, возвращается `fitted = false` — вызывающий
 * рендерит таблицу в `auto`-режиме (без фиксированных ширин).
 */
export const useAutoFitColumnsByContent = (
  containerRef: RefObject<HTMLElement | null>,
  ready: boolean
) => {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [fitted, setFitted] = useState(false)
  const doneRef = useRef(false)

  useLayoutEffect(() => {
    if (doneRef.current || !ready) return
    const el = containerRef.current
    if (!el) return
    const ths = Array.from(
      el.querySelectorAll<HTMLElement>('th[data-autofit-col]')
    )
    if (ths.length === 0) return

    const sizing: ColumnSizingState = {}
    for (const th of ths) {
      const id = th.dataset.autofitCol
      if (id) sizing[id] = Math.max(48, Math.ceil(th.getBoundingClientRect().width))
    }
    if (Object.keys(sizing).length === 0) return

    doneRef.current = true
    // Замер DOM → фиксация ширин (один раз до отрисовки).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColumnSizing(sizing)
    setFitted(true)
  }, [containerRef, ready])

  const onColumnSizingChange: OnChangeFn<ColumnSizingState> = useCallback(
    (updater) => {
      setColumnSizing((prev) =>
        typeof updater === 'function' ? updater(prev) : updater
      )
    },
    []
  )

  return { columnSizing, onColumnSizingChange, fitted }
}

/**
 * Вес колонки по типу данных: коды/числа/даты — узкие, наименования — широкие.
 */
export const weightForDataType = (
  dataType: string | null | undefined,
  isReference = false
): number => {
  if (isReference) return 2.4
  switch (dataType) {
    case 'STRING':
    case 'TEXT':
      return 3
    case 'DATETIME':
      return 1.7
    case 'DATE':
      return 1.2
    case 'DECIMAL':
    case 'INTEGER':
      return 1
    case 'BOOLEAN':
      return 0.7
    default:
      return 1.5
  }
}
