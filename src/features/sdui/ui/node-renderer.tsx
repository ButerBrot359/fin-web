import { memo } from 'react'

import type { ViewNode } from '../types/view'
import { getComponent } from '../lib/component-registry'
import { UnknownNode } from './unknown-node'
import { DeferredNode } from './nodes/deferred/deferred-node'

interface NodeProps {
  node: ViewNode
}

export const NodeRenderer = memo(({ node }: NodeProps) => {
  // SCRUM-384: deferred — данных по binding в OPEN нет, скелетон + кикофф
  // HYDRATE. Перехват до реестра: обычный рендерер ноды не должен
  // монтироваться на пустом state (и слать свои EVENT'ы) до прихода данных.
  const Component =
    node.props?.deferred === true
      ? DeferredNode
      : (getComponent(node.type) ?? UnknownNode)
  // Ложное срабатывание: компоненты объявлены на уровне модулей, реестр
  // лишь выбирает один из них по типу ноды — ничего не создаётся в рендере.
  // eslint-disable-next-line react-hooks/static-components
  return <Component node={node} />
})

NodeRenderer.displayName = 'NodeRenderer'
