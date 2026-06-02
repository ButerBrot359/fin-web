import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

export const HStackNode: FC<NodeProps> = ({ node }) => {
  const gap = (node.props?.gap as number | undefined) ?? 0
  const justify = (node.props?.justify as string | undefined) ?? 'flex-start'
  const align = (node.props?.align as string | undefined) ?? 'stretch'
  const flex = node.props?.flex as number | string | undefined

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: gap * 4,
        justifyContent: justify,
        alignItems: align,
        flex: flex !== undefined ? flex : undefined,
      }}
    >
      {node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}
    </div>
  )
}
