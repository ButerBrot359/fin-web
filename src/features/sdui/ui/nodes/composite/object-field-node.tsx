import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'

export const ObjectFieldNode: FC<NodeProps> = ({ node }) => {
  const visible = (node.props?.visible as boolean | undefined) ?? true

  if (!visible) return null

  return (
    <div
      style={{
        border: '2px dashed #bdbdbd',
        borderRadius: 4,
        padding: 12,
        color: '#9e9e9e',
        fontSize: 13,
      }}
    >
      OBJECT_FIELD (id: {node.id}) — будет реализован позже
    </div>
  )
}
