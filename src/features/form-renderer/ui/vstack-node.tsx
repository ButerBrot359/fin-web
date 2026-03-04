import type { VStackNode as VStackNodeType } from '@/entities/form-config'

import { NodeRenderer } from './node-renderer'

interface VStackNodeProps {
  node: VStackNodeType
}

export const VStackNode = ({ node }: VStackNodeProps) => {
  return (
    <div
      className="flex flex-col"
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
