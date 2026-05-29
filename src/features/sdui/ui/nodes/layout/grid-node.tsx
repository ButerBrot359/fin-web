import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

export const GridNode: FC<NodeProps> = ({ node }) => {
  const columns = (node.props?.columns as number | undefined) ?? 1
  const gap = (node.props?.gap as number | undefined) ?? 0

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: gap * 4,
      }}
    >
      {node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}
    </div>
  )
}
