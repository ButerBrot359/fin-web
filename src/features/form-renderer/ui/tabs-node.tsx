import { useState } from 'react'

import type { TabsNode as TabsNodeType } from '@/entities/form-config'
import { cn } from '@/shared/lib/utils/cn'

import { NodeRenderer } from './node-renderer'

interface TabsNodeProps {
  node: TabsNodeType
}

export const TabsNode = ({ node }: TabsNodeProps) => {
  const [activeKey, setActiveKey] = useState(node.panes[0]?.key ?? '')

  return (
    <div>
      <div className="flex gap-1 border-b border-ui-03">
        {node.panes.map((pane) => (
          <button
            key={pane.key}
            type="button"
            onClick={() => {
              setActiveKey(pane.key)
            }}
            className={cn(
              'rounded-t-md px-4 py-2 text-[14px] font-medium transition-colors',
              activeKey === pane.key
                ? 'bg-ui-06 text-ui-01'
                : 'bg-ui-01 text-ui-05 hover:bg-ui-07'
            )}
          >
            {pane.label}
          </button>
        ))}
      </div>

      {node.panes.map((pane) => (
        <div
          key={pane.key}
          className={cn('pt-4', activeKey !== pane.key && 'hidden')}
        >
          {pane.children.map((child, index) => (
            <NodeRenderer key={index} node={child} />
          ))}
        </div>
      ))}
    </div>
  )
}
