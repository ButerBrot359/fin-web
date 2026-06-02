import type { FC } from 'react'

import type { ViewNode } from '../types/view'
import { getComponent } from '../lib/component-registry'
import { UnknownNode } from './unknown-node'

export const NodeRenderer: FC<{ node: ViewNode }> = ({ node }) => {
  const Component = getComponent(node.type) ?? UnknownNode
  return <Component node={node} />
}
