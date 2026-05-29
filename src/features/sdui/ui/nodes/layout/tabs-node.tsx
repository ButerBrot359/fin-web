import { useState } from 'react'
import type { FC } from 'react'
import { Tabs, Tab } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'
import { useSduiDispatch } from '../../../lib/dispatch'

export const TabsNode: FC<NodeProps> = ({ node }) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const dispatch = useSduiDispatch()

  const tabs = node.children ?? []

  const handleChange = (_: React.SyntheticEvent, newIndex: number) => {
    setActiveIndex(newIndex)

    const tabNode = tabs[newIndex]
    if (tabNode) {
      const fieldEventAction = tabNode.actions?.find((a) => a.actionId === 'fieldEvent')
      if (fieldEventAction) {
        dispatch({
          type: 'EVENT',
          sourceNodeId: tabNode.id,
          trigger: fieldEventAction.trigger,
        })
      }
    }
  }

  const activeTab = tabs[activeIndex]

  return (
    <div>
      <Tabs value={activeIndex} onChange={handleChange}>
        {tabs.map((tab, idx) => (
          <Tab key={tab.id} label={(tab.props?.label as string | undefined) ?? `Tab ${idx + 1}`} />
        ))}
      </Tabs>
      <div style={{ paddingTop: 16 }}>
        {activeTab?.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}
      </div>
    </div>
  )
}
