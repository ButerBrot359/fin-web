import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { resolveStackGap } from '../../../lib/utils/resolve-stack-gap'
import { NodeRenderer } from '../../node-renderer'

export const GridNode: FC<NodeProps> = ({ node }) => {
  const columns = (node.props?.columns as number | undefined) ?? 1
  const gap = resolveStackGap(node.props?.gap as number | undefined)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${String(columns)}, 1fr)`,
        gap,
      }}
    >
      {node.children?.map((c) => (
        <NodeRenderer key={c.id} node={c} />
      ))}
    </div>
  )
}
