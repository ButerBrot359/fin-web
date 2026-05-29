import { useEffect } from 'react'
import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

export const PageNode: FC<NodeProps> = ({ node }) => {
  const title = node.props?.title as string | undefined

  useEffect(() => {
    if (title) {
      document.title = title
    }
  }, [title])

  return (
    <div className="flex flex-col gap-4">
      {node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}
    </div>
  )
}
