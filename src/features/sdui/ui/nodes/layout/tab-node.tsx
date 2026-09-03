import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

export const TabNode: FC<NodeProps> = ({ node }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 auto',
      minHeight: 0,
    }}
  >
    {node.children?.map((c) => (
      <NodeRenderer key={c.id} node={c} />
    ))}
  </div>
)
