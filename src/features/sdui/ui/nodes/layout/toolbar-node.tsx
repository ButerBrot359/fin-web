import { useLayoutEffect, useRef, useState, type FC } from 'react'

import type { NodeProps, ViewNode } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'
import { OverflowContext } from '../../../lib/overflow/overflow-context'
import {
  computeOverflow,
  type OverflowItem,
} from '../../../lib/overflow/compute-overflow'

const PINNED_IDS = new Set(['btn.postClose', 'btn.more', 'spacer.more'])
const HYSTERESIS_PX = 4

export const ToolbarNode: FC<NodeProps> = ({ node }) => {
  const children = node.children ?? []
  const containerRef = useRef<HTMLDivElement>(null)
  const childRefs = useRef<Map<string, HTMLElement>>(new Map())
  const lastWidth = useRef(0)
  const [collapsedIds, setCollapsedIds] = useState<string[]>([])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const recompute = () => {
      const available = container.clientWidth
      if (Math.abs(available - lastWidth.current) < HYSTERESIS_PX) return
      lastWidth.current = available

      const items: OverflowItem[] = children.map((c) => ({
        id: c.id,
        width: childRefs.current.get(c.id)?.offsetWidth ?? 0,
        pinned: PINNED_IDS.has(c.id),
      }))
      const moreWidth = childRefs.current.get('btn.more')?.offsetWidth ?? 0
      setCollapsedIds(computeOverflow(items, available, moreWidth))
    }

    const observer = new ResizeObserver(recompute)
    observer.observe(container)
    recompute()
    return () => {
      observer.disconnect()
    }
  }, [children])

  const collapsedSet = new Set(collapsedIds)
  const collapsedNodes: ViewNode[] = children.filter((c) =>
    collapsedSet.has(c.id)
  )

  return (
    <OverflowContext.Provider value={{ collapsedNodes }}>
      <div ref={containerRef} className="flex items-center gap-1">
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
