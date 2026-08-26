import { memo } from 'react'

import type { ViewNode } from '../types/view'
import { getComponent } from '../lib/component-registry'
import { isNodeVisible } from '../lib/utils/node-visibility'
import { UnknownNode } from './unknown-node'
import { DeferredNode } from './nodes/deferred/deferred-node'

interface NodeProps {
  node: ViewNode
}

export const NodeRenderer = memo(({ node }: NodeProps) => {
  // Единая точка гашения: props.visible === false скрывает узел любого типа
  // вместе с поддеревом — см. node-visibility.ts. Гейт стоит ДО deferred:
  // невидимая отложенная нода не должна показывать скелетон и слать HYDRATE.
  if (!isNodeVisible(node)) return null

  // SCRUM-384: deferred — данных по binding в OPEN нет, скелетон + кикофф
  // HYDRATE. Перехват до реестра: обычный рендерер ноды не должен
  // монтироваться на пустом state (и слать свои EVENT'ы) до прихода данных.
  // Компонент не создаётся на рендере, а достаётся из статического реестра —
  // это и есть диспетчеризация SDUI; правило про state-reset тут неприменимо.
  const Component =
    node.props?.deferred === true
      ? DeferredNode
      : (getComponent(node.type) ?? UnknownNode)
  // eslint-disable-next-line react-hooks/static-components
  return <Component node={node} />
})

NodeRenderer.displayName = 'NodeRenderer'
