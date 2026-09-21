import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { TreeItemNode } from './tree-item-node'

/**
 * SCRUM-308 §4.1 (ADR-0078_SDUI): дерево — контейнер узлов TREE_NODE. Модель
 * PUSH: все узлы приезжают сразу в children, ленивой подгрузки нет; клик по
 * узлу — обычный COMMAND тем же каналом, что кнопка (нового механизма нет).
 */
export const TreeNode: FC<NodeProps> = ({ node }) => {
  const items = (node.children ?? []).filter((c) => c.type === 'TREE_NODE')
  if (items.length === 0) return null
  return (
    <ul className="m-0 list-none p-0">
      {items.map((item) => (
        <TreeItemNode key={item.id} node={item} />
      ))}
    </ul>
  )
}
