import { useCallback, useMemo, useState } from 'react'

/**
 * Выделение НЕСКОЛЬКИХ строк табличной части — как в таблице 1С: Ctrl добавляет строку к
 * выделению, Shift выделяет диапазон от якоря, Ctrl+A выделяет всё, а «Удалить»/Del снимает
 * все выделенные строки разом. Без этого удалить десяток позиций из подбора можно было
 * только по одной (обращение 21.09.2026).
 *
 * Текущая строка (её ведут сами таблицы через selectedIndex/selectedRowId) остаётся отдельным
 * понятием — как в 1С, где текущая строка одна, а выделенных может быть несколько. Хук хранит
 * только набор выделенных и якорь диапазона.
 */
export interface VyborStrok {
  /** rowId выделенных строк. */
  vydelennye: ReadonlySet<string>
  /** Выделенные в порядке видимого набора — в этом же порядке уходят команде удаления. */
  vydelennyeRowIds: string[]
  /** Клик по строке с модификаторами клавиатуры. */
  klik: (
    rowId: string,
    visibleIndex: number,
    mods: { ctrl: boolean; shift: boolean }
  ) => void
  /** Выделить ровно одну строку (переход стрелками, выбор после удаления) либо снять выделение. */
  tolkoOdna: (rowId: string | null) => void
  /** Расширить выделение от якоря до строки с данным индексом (Shift и стрелки). */
  rasshirit: (visibleIndex: number) => void
  /** Ctrl+A — выделить все видимые строки. */
  vydelitVse: () => void
}

interface Sostoyanie {
  nabor: ReadonlySet<string>
  yakor: number | null
}

const PUSTO: Sostoyanie = { nabor: new Set<string>(), yakor: null }

export function useTableMultiSelection(
  visibleRows: { rowId: string }[]
): VyborStrok {
  const [sostoyanie, setSostoyanie] = useState<Sostoyanie>(PUSTO)

  const diapazon = useCallback(
    (ot: number, doKuda: number): Set<string> => {
      const nachalo = Math.min(ot, doKuda)
      const konets = Math.max(ot, doKuda)
      const nabor = new Set<string>()
      for (
        let i = Math.max(nachalo, 0);
        i <= konets && i < visibleRows.length;
        i++
      ) {
        nabor.add(visibleRows[i].rowId)
      }
      return nabor
    },
    [visibleRows]
  )

  const klik = useCallback(
    (
      rowId: string,
      visibleIndex: number,
      mods: { ctrl: boolean; shift: boolean }
    ) => {
      setSostoyanie((prev) => {
        if (mods.shift && prev.yakor !== null) {
          return {
            nabor: diapazon(prev.yakor, visibleIndex),
            yakor: prev.yakor,
          }
        }
        if (mods.ctrl) {
          const nabor = new Set(prev.nabor)
          if (nabor.has(rowId)) nabor.delete(rowId)
          else nabor.add(rowId)
          return { nabor, yakor: visibleIndex }
        }
        return { nabor: new Set([rowId]), yakor: visibleIndex }
      })
    },
    [diapazon]
  )

  const tolkoOdna = useCallback(
    (rowId: string | null) => {
      setSostoyanie(() =>
        rowId === null
          ? PUSTO
          : {
              nabor: new Set([rowId]),
              yakor: visibleRows.findIndex((row) => row.rowId === rowId),
            }
      )
    },
    [visibleRows]
  )

  const rasshirit = useCallback(
    (visibleIndex: number) => {
      setSostoyanie((prev) => ({
        nabor: diapazon(prev.yakor ?? visibleIndex, visibleIndex),
        yakor: prev.yakor ?? visibleIndex,
      }))
    },
    [diapazon]
  )

  const vydelitVse = useCallback(() => {
    setSostoyanie((prev) => ({
      nabor: new Set(visibleRows.map((row) => row.rowId)),
      yakor: prev.yakor ?? 0,
    }))
  }, [visibleRows])

  // Строки могли исчезнуть (удаление, отбор, переоткрытие ТЧ), а выделение не должно
  // ссылаться на то, чего в наборе больше нет: иначе «Удалить» ушло бы по чужому rowId.
  // Поэтому наружу отдаём пересечение с видимым набором, а не сырой набор.
  const vydelennyeRowIds = useMemo(
    () =>
      visibleRows
        .map((row) => row.rowId)
        .filter((rowId) => sostoyanie.nabor.has(rowId)),
    [visibleRows, sostoyanie]
  )

  return {
    vydelennye: sostoyanie.nabor,
    vydelennyeRowIds,
    klik,
    tolkoOdna,
    rasshirit,
    vydelitVse,
  }
}
