import { useRef, useState, type FC } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/utils/cn'

import {
  GRID_UNITS,
  dropEmptyRows,
  reflowZone,
  rowFreeUnits,
  type GridItem,
  type GridZone,
} from '../lib/customize-form/grid-zones'
import { useCustomizeFormDndStore } from '../lib/customize-form/customize-form-dnd-store'

interface CustomizeFormGridEditorProps {
  zones: GridZone[]
  selectedId: string | null
  busy: boolean
  onSelect: (nodeId: string) => void
  onChange: (zones: GridZone[]) => void
  /**
   * Бросок элемента ЧУЖОЙ зоны (перенос между блоками, словарь v3): сам
   * редактор знает только свои зоны — перестановку между секциями делает
   * диалог. Не передан — чужие броски игнорируются.
   */
  onExternalDrop?: (nodeId: string, target: ExternalDropTarget) => void
}

export interface ExternalDropTarget {
  zoneId: string
  rowIndex: number
  itemIndex: number
  newRow: boolean
}

interface DropTarget {
  zoneIndex: number
  /** Индекс строки; вставка НОВОЙ строкой кодируется rowIndex с newRow=true. */
  rowIndex: number
  itemIndex: number
  newRow: boolean
}

/**
 * DnD-редактор грид-зон «Изменить форму» v4 (спека 2026-09-11): строки — та же
 * 24-сетка, что на форме. Перетаскивание за тело — перемещение (подсветка места
 * вставки; бросок между строками = новая строка), за правую кромку — ширина с
 * прилипанием к единицам сетки в пределах свободного остатка строки. Нативный
 * HTML5 DnD, без зависимостей; клавиатурный путь — панель под редактором.
 */
export const CustomizeFormGridEditor: FC<CustomizeFormGridEditorProps> = ({
  zones,
  selectedId,
  busy,
  onSelect,
  onChange,
  onExternalDrop,
}) => {
  const { t } = useTranslation()
  // Глобальный dragged (общий стор): перетаскивание видно ВСЕМ инстансам
  // редактора — цели подсвечиваются и в чужих зонах (перенос между блоками).
  const dragged = useCustomizeFormDndStore((s) => s.draggedNodeId)
  const startDrag = useCustomizeFormDndStore((s) => s.start)
  const clearDrag = useCustomizeFormDndStore((s) => s.clear)
  const [target, setTarget] = useState<DropTarget | null>(null)
  const [resizePreview, setResizePreview] = useState<Map<string, number>>(
    new Map()
  )
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const mutate = (fn: (next: GridZone[]) => void) => {
    const next = zones.map((z) => ({
      ...z,
      rows: z.rows.map((r) => r.map((i) => ({ ...i }))),
    }))
    fn(next)
    next.forEach(dropEmptyRows)
    onChange(next)
  }

  const findItem = (
    list: GridZone[],
    nodeId: string
  ): { zone: GridZone; row: GridItem[]; item: GridItem } | null => {
    for (const zone of list) {
      for (const row of zone.rows) {
        const item = row.find((i) => i.nodeId === nodeId)
        if (item) return { zone, row, item }
      }
    }
    return null
  }

  const drop = (e?: React.DragEvent) => {
    // Всплытие ячейка → строка вызывало drop дважды — второй проход по
    // старой модели делал каскад перетекания недетерминированным.
    e?.stopPropagation()
    if (!dragged || !target) return
    // Элемент не из этих зон — перенос между блоками решает диалог.
    if (!findItem(zones, dragged)) {
      const zone = zones[target.zoneIndex] as GridZone | undefined
      if (zone && onExternalDrop) {
        onExternalDrop(dragged, {
          zoneId: zone.zoneId,
          rowIndex: target.rowIndex,
          itemIndex: target.itemIndex,
          newRow: target.newRow,
        })
      }
      clearDrag()
      setTarget(null)
      return
    }
    mutate((next) => {
      const source = findItem(next, dragged)
      if (!source) return
      const zone = next[target.zoneIndex]
      const sourceItemIndex = source.row.indexOf(source.item)
      source.row.splice(sourceItemIndex, 1)
      if (target.newRow) {
        // Индекс строки-цели фиксировался ДО удаления: опустевшая строка
        // источника выше цели сдвигает нумерацию на единицу.
        let rowIndex = target.rowIndex
        if (source.row.length === 0) {
          const emptyIndex = zone.rows.indexOf(source.row)
          if (emptyIndex >= 0 && emptyIndex < rowIndex) rowIndex--
          zone.rows.splice(emptyIndex, 1)
        }
        zone.rows.splice(rowIndex, 0, [source.item])
      } else {
        const row = zone.rows[target.rowIndex] as GridItem[] | undefined
        if (!row) return
        let index = target.itemIndex
        // Перестановка внутри своей строки: удаление источника сместило цель.
        if (row === source.row && sourceItemIndex < index) index--
        // Вставка БЕЗ ужатия: переполненная строка перетекает на следующую
        // (reflowZone), как текст — интуиция «подвинься» вместо запрета.
        row.splice(Math.min(index, row.length), 0, source.item)
        reflowZone(zone, source.item.nodeId)
      }
    })
    clearDrag()
    setTarget(null)
  }

  const startResize = (
    e: React.MouseEvent,
    zoneIndex: number,
    rowIndex: number,
    nodeId: string
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const rowEl = rowRefs.current.get(
      `${String(zoneIndex)}:${String(rowIndex)}`
    )
    if (!rowEl) return
    const unit = rowEl.getBoundingClientRect().width / GRID_UNITS
    const zone = zones[zoneIndex]
    const row = zone.rows[rowIndex]
    const item = row.find((i) => i.nodeId === nodeId)
    if (!item) return
    const startX = e.clientX
    const startSpan = item.span
    const maxSpan = startSpan + rowFreeUnits(row)

    const move = (ev: MouseEvent) => {
      const deltaUnits = Math.round((ev.clientX - startX) / unit)
      const span = Math.max(1, Math.min(maxSpan, startSpan + deltaUnits))
      setResizePreview(new Map([[nodeId, span]]))
    }
    const up = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      const deltaUnits = Math.round((ev.clientX - startX) / unit)
      const span = Math.max(1, Math.min(maxSpan, startSpan + deltaUnits))
      setResizePreview(new Map())
      if (span !== startSpan) {
        mutate((next) => {
          const found = findItem(next, nodeId)
          if (found) found.item.span = span
        })
      }
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const isCellTarget = (
    zoneIndex: number,
    rowIndex: number,
    itemIndex: number
  ): boolean =>
    target != null &&
    !target.newRow &&
    target.zoneIndex === zoneIndex &&
    target.rowIndex === rowIndex &&
    target.itemIndex === itemIndex

  const rowSeparator = (zoneIndex: number, rowIndex: number) => (
    <div
      key={`sep-${String(rowIndex)}`}
      onDragOver={(e) => {
        e.preventDefault()
        setTarget({ zoneIndex, rowIndex, itemIndex: 0, newRow: true })
      }}
      onDrop={drop}
      className={cn(
        'h-2 rounded transition-colors',
        dragged && 'h-4',
        target?.newRow &&
          target.zoneIndex === zoneIndex &&
          target.rowIndex === rowIndex
          ? 'bg-accent-02'
          : dragged
            ? 'bg-ui-04'
            : 'bg-transparent'
      )}
    />
  )

  return (
    <div className="flex flex-col gap-2">
      {zones.map((zone, zoneIndex) => (
        <div key={zone.zoneId} className="flex flex-col gap-1">
          {zone.title && (
            <Typography variant="body2" className="text-ui-05">
              {zone.title}
            </Typography>
          )}
          <div className="border-ui-03 bg-ui-02 flex flex-col rounded-lg border p-2">
            {zone.rows.map((row, rowIndex) => (
              <div key={row[0]?.nodeId ?? rowIndex} className="flex flex-col">
                {rowSeparator(zoneIndex, rowIndex)}
                <div
                  ref={(el) => {
                    if (el)
                      rowRefs.current.set(
                        `${String(zoneIndex)}:${String(rowIndex)}`,
                        el
                      )
                  }}
                  className="grid gap-x-2"
                  style={{
                    gridTemplateColumns: `repeat(${String(GRID_UNITS)}, 1fr)`,
                  }}
                  onDragOver={(e) => {
                    // Пустота строки (правее последней плашки, зазоры) — тоже
                    // цель: индекс вставки вычисляется по X. Без этого курсор
                    // в пустотах показывал «нельзя» и казалось, что тащить
                    // можно только вверх (живой дефект 11.09).
                    e.preventDefault()
                    if (!dragged) return
                    const cells = [...e.currentTarget.children] as HTMLElement[]
                    let index = row.length
                    for (let ci = 0; ci < cells.length; ci++) {
                      const r = cells[ci].getBoundingClientRect()
                      if (e.clientX < r.left + r.width / 2) {
                        index = ci
                        break
                      }
                    }
                    setTarget({
                      zoneIndex,
                      rowIndex,
                      itemIndex: index,
                      newRow: false,
                    })
                  }}
                  onDrop={drop}
                >
                  {row.map((item, itemIndex) => (
                    <div
                      key={item.nodeId}
                      style={{
                        gridColumn: `span ${String(resizePreview.get(item.nodeId) ?? item.span)}`,
                        minWidth: 0,
                      }}
                      className="relative"
                      draggable={!busy}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move'
                        // Без setData часть браузеров не инициализирует drag.
                        e.dataTransfer.setData('text/plain', item.nodeId)
                        // setState — СТРОГО следующим тиком: синхронный
                        // ре-рендер меняет классы перетаскиваемого узла прямо
                        // в dragstart, и Chrome немедленно отменяет drag.
                        // Живой баг 11.09: «выбранная плашка не тащится,
                        // а после удачного переноса не тащится уже она».
                        setTimeout(() => {
                          startDrag(item.nodeId)
                          onSelect(item.nodeId)
                        }, 0)
                      }}
                      onDragEnd={() => {
                        clearDrag()
                        setTarget(null)
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        if (!dragged || dragged === item.nodeId) return
                        const rect = e.currentTarget.getBoundingClientRect()
                        const before = e.clientX < rect.left + rect.width / 2
                        setTarget({
                          zoneIndex,
                          rowIndex,
                          itemIndex: itemIndex + (before ? 0 : 1),
                          newRow: false,
                        })
                      }}
                      onDrop={drop}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (!busy) onSelect(item.nodeId)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !busy) onSelect(item.nodeId)
                        }}
                        className={cn(
                          'w-full cursor-grab truncate rounded-md border px-2 py-1.5 text-left text-xs select-none active:cursor-grabbing',
                          selectedId === item.nodeId
                            ? 'border-accent-02 bg-ui-04 text-accent-02'
                            : 'border-ui-03 bg-ui-01 text-ui-06',
                          item.hidden && 'border-dashed opacity-40',
                          dragged === item.nodeId && 'opacity-30'
                        )}
                      >
                        {item.label === '⋯' ? (
                          <span className="text-ui-05 italic">
                            {t('sdui.customizeForm.unnamed')}
                          </span>
                        ) : (
                          item.label
                        )}
                      </div>
                      {/* Слоты вставки: при перетаскивании видны ВСЕ доступные
                          места (иначе казалось, что бросать можно только в
                          междустрочья — живой отзыв 11.09). */}
                      {dragged && dragged !== item.nodeId && (
                        <div
                          className={cn(
                            'absolute top-0 bottom-0 -left-[7px] w-1.5 rounded',
                            isCellTarget(zoneIndex, rowIndex, itemIndex)
                              ? 'bg-accent-02'
                              : 'bg-ui-04'
                          )}
                        />
                      )}
                      {dragged && itemIndex === row.length - 1 && (
                        <div
                          className={cn(
                            'absolute top-0 -right-[7px] bottom-0 w-1.5 rounded',
                            isCellTarget(zoneIndex, rowIndex, row.length)
                              ? 'bg-accent-02'
                              : 'bg-ui-04'
                          )}
                        />
                      )}
                      {/* Ручка ширины: тянется в сторону свободного места строки. */}
                      <div
                        onMouseDown={(e) => {
                          startResize(e, zoneIndex, rowIndex, item.nodeId)
                        }}
                        className="hover:bg-accent-02 absolute top-1 right-0 bottom-1 w-1.5 cursor-col-resize rounded"
                        role="presentation"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {rowSeparator(zoneIndex, zone.rows.length)}
          </div>
        </div>
      ))}
    </div>
  )
}
