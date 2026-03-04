import type { HStackNode as HStackNodeType } from '@/entities/form-config'
import { cn } from '@/shared/lib/utils/cn'

import { NodeRenderer } from './node-renderer'

interface HStackNodeProps {
  node: HStackNodeType
}

const ALIGN_MAP = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
} as const

export const HStackNode = ({ node }: HStackNodeProps) => {
  const alignClass = node.align ? ALIGN_MAP[node.align] : 'items-stretch'

  return (
    <div
      className={cn('flex', alignClass)}
      style={{
        gap: node.gap ? `${String(node.gap * 4)}px` : undefined,
        flex: node.flex,
      }}
    >
      {node.children.map((child, index) => (
        <NodeRenderer key={index} node={child} />
      ))}
    </div>
  )
}
