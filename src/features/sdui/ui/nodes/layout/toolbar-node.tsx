import { useLayoutEffect, useRef, useState, type FC } from 'react'

import type { NodeProps, ViewNode } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'
import { OverflowContext } from '../../../lib/overflow/overflow-context'
import { isNodeVisible } from '../../../lib/utils/node-visibility'
import {
  computeOverflow,
  type OverflowItem,
} from '../../../lib/overflow/compute-overflow'

const HYSTERESIS_PX = 4

export const ToolbarNode: FC<NodeProps> = ({ node }) => {
  // Скрытые узлы выбывают до раскладки: каждый ребёнок получает свою обёртку с
  // gap, и его ещё и меряют для «Ещё» — пустая обёртка съедала бы ширину.
  const children = (node.children ?? []).filter(isNodeVisible)
  const containerRef = useRef<HTMLDivElement>(null)
  const childRefs = useRef<Map<string, HTMLElement>>(new Map())
  const lastWidth = useRef(0)
  const [collapsedIds, setCollapsedIds] = useState<string[]>([])

  // SCRUM-362 B-5: pinned/overflowHost приходят пропами с бэка (эмитится
  // только true). Нет узла-хозяина «Ещё» ⇒ сворачивание не включается вовсе,
  // содержимое уходит в горизонтальный скролл (панели списка и отчёта
  // btn.more не строят — пиннится тестом бэка).
  const overflowHostId = children.find(
    (c) => c.props?.overflowHost === true
  )?.id

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    // Без хозяина сворачивание выключено: состояние не пересчитываем, а
    // игнорируем при рендере (см. collapsedSet ниже) — setState тут не нужен.
    if (!overflowHostId) return

    const recompute = () => {
      const available = container.clientWidth
      if (Math.abs(available - lastWidth.current) < HYSTERESIS_PX) return
      lastWidth.current = available

      const items: OverflowItem[] = (node.children ?? [])
        .filter(isNodeVisible)
        .map((c) => ({
          id: c.id,
          width: childRefs.current.get(c.id)?.offsetWidth ?? 0,
          pinned: c.props?.pinned === true,
          overflowHost: c.props?.overflowHost === true,
        }))
      const moreWidth = childRefs.current.get(overflowHostId)?.offsetWidth ?? 0
      setCollapsedIds(computeOverflow(items, available, moreWidth))
    }

    const observer = new ResizeObserver(recompute)
    observer.observe(container)
    recompute()
    return () => {
      observer.disconnect()
    }
  }, [node.children, overflowHostId])

  const collapsedSet = new Set(overflowHostId ? collapsedIds : [])
  const collapsedNodes: ViewNode[] = children.filter((c) =>
    collapsedSet.has(c.id)
  )

  return (
    <OverflowContext.Provider value={{ collapsedNodes }}>
      <div
        ref={containerRef}
        className={`flex items-center gap-1${overflowHostId ? '' : ' overflow-x-auto'}`}
      >
        {children.map((c) => (
          <div
            key={c.id}
            ref={(el) => {
              if (el) childRefs.current.set(c.id, el)
              else childRefs.current.delete(c.id)
            }}
            style={{ display: collapsedSet.has(c.id) ? 'none' : 'inline-flex' }}
          >
            <NodeRenderer node={c} />
          </div>
        ))}
      </div>
    </OverflowContext.Provider>
  )
}
