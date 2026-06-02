import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

export const ToolbarNode: FC<NodeProps> = ({ node }) => (
  <div className="flex items-center gap-1">
    {node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}
  </div>
)
