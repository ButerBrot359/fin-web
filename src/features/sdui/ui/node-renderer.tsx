import { memo } from 'react'

import type { ViewNode } from '../types/view'
import { getComponent } from '../lib/component-registry'
import { UnknownNode } from './unknown-node'

interface NodeProps {
  node: ViewNode
}

export const NodeRenderer = memo(({ node }: NodeProps) => {
  const Component = getComponent(node.type) ?? UnknownNode
  return <Component node={node} />
})

NodeRenderer.displayName = 'NodeRenderer'
