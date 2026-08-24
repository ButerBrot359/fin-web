import { useEffect } from 'react'
import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'
import { ListOutputDialogNode } from '../composite/list-output-dialog-node'

export const PageNode: FC<NodeProps> = ({ node }) => {
  const title = node.props?.title as string | undefined

  useEffect(() => {
    if (title) {
      document.title = title
    }
  }, [title])

  if (node.props?.kind === 'LIST_OUTPUT_DIALOG') {
    return <ListOutputDialogNode node={node} />
  }

  return (
    <div className="flex flex-col gap-4">
      {node.children?.map((c) => (
        <NodeRenderer key={c.id} node={c} />
      ))}
    </div>
  )
}
