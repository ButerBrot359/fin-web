import { memo } from 'react'

import type { ViewNode } from '../types/view'
import { getComponent } from '../lib/component-registry'
import { isNodeVisible } from '../lib/utils/node-visibility'
import { UnknownNode } from './unknown-node'

interface NodeProps {
  node: ViewNode
}

export const NodeRenderer = memo(({ node }: NodeProps) => {
  // Единая точка гашения: props.visible === false скрывает узел любого типа
  // вместе с поддеревом — см. node-visibility.ts.
  if (!isNodeVisible(node)) return null

  // Компонент не создаётся на рендере, а достаётся из статического реестра по
  // типу узла — это и есть диспетчеризация SDUI; правило про state-reset тут
  // неприменимо.
  const Component = getComponent(node.type) ?? UnknownNode
  // eslint-disable-next-line react-hooks/static-components
  return <Component node={node} />
})

NodeRenderer.displayName = 'NodeRenderer'
