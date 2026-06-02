import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

export const VStackNode: FC<NodeProps> = ({ node }) => {
  const gap = (node.props?.gap as number | undefined) ?? 0
  const padding = (node.props?.padding as number | undefined) ?? 0
  const align = (node.props?.align as string | undefined) ?? 'stretch'
  const flex = node.props?.flex as number | string | undefined

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: gap * 4,
        padding: padding * 4,
        alignItems: align,
        flex: flex !== undefined ? flex : undefined,
      }}
    >
      {node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}
    </div>
  )
}
