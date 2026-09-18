import { useState, type FC } from 'react'
import { Typography } from '@mui/material'

import { cn } from '@/shared/lib/utils/cn'

import {
  GRID_UNITS,
  cloneZones,
  dropEmptyRows,
  type GridZone,
} from '../lib/customize-form/grid-zones'
import {
  applyGridDrop,
  findGridItem,
  type ExternalDropTarget,
  type GridDropTarget,
} from '../lib/customize-form/grid-drop'
import { useCustomizeFormDndStore } from '../lib/customize-form/customize-form-dnd-store'
import { gridRowKey, useGridResize } from '../lib/hooks/use-grid-resize'
import { GridEditorItem } from './grid-editor-item'

export type { ExternalDropTarget }

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
  // Глобальный dragged (общий стор): перетаскивание видно ВСЕМ инстансам
  // редактора — цели подсвечиваются и в чужих зонах (перенос между блоками).
  const dragged = useCustomizeFormDndStore((s) => s.draggedNodeId)
  const clearDrag = useCustomizeFormDndStore((s) => s.clear)
  const [target, setTarget] = useState<GridDropTarget | null>(null)

  const { resizePreview, rowRefs, startResize } = useGridResize(
    zones,
    (nodeId, span) => {
      const next = cloneZones(zones)
      const found = findGridItem(next, nodeId)
      if (found) found.item.span = span
      next.forEach(dropEmptyRows)
      onChange(next)
    }
  )

  const drop = (e?: React.DragEvent) => {
    // Всплытие ячейка → строка вызывало drop дважды — второй проход по
    // старой модели делал каскад перетекания недетерминированным.
    e?.stopPropagation()
    if (!dragged || !target) return
    // Элемент не из этих зон — перенос между блоками решает диалог.
    if (!findGridItem(zones, dragged)) {
      const zone = zones[target.zoneIndex] as GridZone | undefined
      if (zone && onExternalDrop) {
        onExternalDrop(dragged, {
          zoneId: zone.zoneId,
          rowIndex: target.rowIndex,
          itemIndex: target.itemIndex,
          newRow: target.newRow,
        })
      }
    } else {
      onChange(applyGridDrop(zones, dragged, target))
    }
    clearDrag()
    setTarget(null)
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
                      rowRefs.current.set(gridRowKey(zoneIndex, rowIndex), el)
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
                    <GridEditorItem
                      key={item.nodeId}
                      item={item}
                      span={resizePreview.get(item.nodeId) ?? item.span}
                      isLastInRow={itemIndex === row.length - 1}
                      selected={selectedId === item.nodeId}
                      busy={busy}
                      leftSlotActive={isCellTarget(
                        zoneIndex,
                        rowIndex,
                        itemIndex
                      )}
                      rightSlotActive={isCellTarget(
                        zoneIndex,
                        rowIndex,
                        row.length
                      )}
                      onSelect={onSelect}
                      onHover={(before) => {
                        setTarget({
                          zoneIndex,
                          rowIndex,
                          itemIndex: itemIndex + (before ? 0 : 1),
                          newRow: false,
                        })
                      }}
                      onDrop={drop}
                      onTargetClear={() => {
                        setTarget(null)
                      }}
                      onResizeStart={(e) => {
                        startResize(e, zoneIndex, rowIndex, item.nodeId)
                      }}
                    />
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
