import { memo } from 'react'

import type { ViewNode } from '../types/view'
import { getComponent } from '../lib/component-registry'
import { isNodeVisible } from '../lib/utils/node-visibility'
import { useValidationAnchorBinding } from '../lib/validation/use-validation-anchor'
import { UnknownNode } from './unknown-node'
import { DeferredNode } from './nodes/deferred/deferred-node'

interface NodeProps {
  node: ViewNode
}

export const NodeRenderer = memo(({ node }: NodeProps) => {
  // SCRUM-317: якорь тултипа-навигатора ошибок. display:contents не участвует
  // в раскладке; обёртка появляется ТОЛЬКО у целей текущего отчёта — в обычной
  // жизни дерево рендерится без неё.
  const anchorBinding = useValidationAnchorBinding(node)

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
  if (anchorBinding) {
    return (
      <span style={{ display: 'contents' }} data-sdui-anchor={anchorBinding}>
        {/* eslint-disable-next-line react-hooks/static-components -- диспетчеризация из статического реестра, см. комментарий выше */}
        <Component node={node} />
      </span>
    )
  }
  // eslint-disable-next-line react-hooks/static-components
  return <Component node={node} />
})

NodeRenderer.displayName = 'NodeRenderer'
