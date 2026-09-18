import type { DragEvent, FC, MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/utils/cn'

import type { GridItem } from '../lib/customize-form/grid-zones'
import { useCustomizeFormDndStore } from '../lib/customize-form/customize-form-dnd-store'

interface GridEditorItemProps {
  item: GridItem
  /** Отображаемая ширина в единицах сетки: превью ресайза либо span элемента. */
  span: number
  isLastInRow: boolean
  selected: boolean
  busy: boolean
  /** Слот вставки слева/справа — цель текущего броска (подсветка). */
  leftSlotActive: boolean
  rightSlotActive: boolean
  onSelect: (nodeId: string) => void
  /** dragover над плашкой: before — курсор в левой половине. */
  onHover: (before: boolean) => void
  onDrop: (e: DragEvent) => void
  /** Сброс цели вставки по окончании перетаскивания. */
  onTargetClear: () => void
  onResizeStart: (e: MouseEvent) => void
}

/**
 * Плашка элемента грид-редактора: тянется за тело (перемещение), за правую
 * кромку — ширина. При перетаскивании показывает слоты вставки по обе стороны:
 * видны ВСЕ доступные места (иначе казалось, что бросать можно только в
 * междустрочья — живой отзыв 11.09).
 */
export const GridEditorItem: FC<GridEditorItemProps> = ({
  item,
  span,
  isLastInRow,
  selected,
  busy,
  leftSlotActive,
  rightSlotActive,
  onSelect,
  onHover,
  onDrop,
  onTargetClear,
  onResizeStart,
}) => {
  const { t } = useTranslation()
  const dragged = useCustomizeFormDndStore((s) => s.draggedNodeId)
  const startDrag = useCustomizeFormDndStore((s) => s.start)
  const clearDrag = useCustomizeFormDndStore((s) => s.clear)

  return (
    <div
      style={{
        gridColumn: `span ${String(span)}`,
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
        onTargetClear()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!dragged || dragged === item.nodeId) return
        const rect = e.currentTarget.getBoundingClientRect()
        onHover(e.clientX < rect.left + rect.width / 2)
      }}
      onDrop={onDrop}
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
          selected
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
      {dragged && dragged !== item.nodeId && (
        <div
          className={cn(
            'absolute top-0 bottom-0 -left-[7px] w-1.5 rounded',
            leftSlotActive ? 'bg-accent-02' : 'bg-ui-04'
          )}
        />
      )}
      {dragged && isLastInRow && (
        <div
          className={cn(
            'absolute top-0 -right-[7px] bottom-0 w-1.5 rounded',
            rightSlotActive ? 'bg-accent-02' : 'bg-ui-04'
          )}
        />
      )}
      {/* Ручка ширины: тянется в сторону свободного места строки. */}
      <div
        onMouseDown={onResizeStart}
        className="hover:bg-accent-02 absolute top-1 right-0 bottom-1 w-1.5 cursor-col-resize rounded"
        role="presentation"
      />
    </div>
  )
}
