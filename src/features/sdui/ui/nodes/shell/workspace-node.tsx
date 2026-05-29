import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

export const WorkspaceNode: FC<NodeProps> = ({ node }) => (
  <div>{node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}</div>
)
