import { useState } from 'react'
import type { FC } from 'react'
import { Tabs, Tab } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'
import { useSduiDispatch } from '../../../lib/dispatch'

export const TabsNode: FC<NodeProps> = ({ node }) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const dispatch = useSduiDispatch()

  // Вкладка скрывается, если бэк прислал props.visible === false (по умолчанию видима).
  // Нужно для условных вкладок (напр. «График платежей» по галке «Использовать график»).
  const tabs = (node.children ?? []).filter(
    (t) => ((t.props?.visible as boolean | undefined) ?? true),
  )

  const handleChange = (_: React.SyntheticEvent, newIndex: number) => {
    setActiveIndex(newIndex)

    const tabNode = tabs[newIndex]
    if (tabNode) {
      const fieldEventAction = tabNode.actions?.find((a) => a.actionId === 'fieldEvent')
      if (fieldEventAction) {
        void dispatch({
          type: 'EVENT',
          sourceNodeId: tabNode.id,
          trigger: fieldEventAction.trigger,
        })
      }
    }
  }

  // Клампим индекс: условная вкладка могла исчезнуть и сдвинуть длину списка.
  const safeIndex = tabs.length === 0 ? 0 : Math.min(activeIndex, tabs.length - 1)
  const activeTab = tabs[safeIndex]

  return (
    <div>
      <Tabs value={safeIndex} onChange={handleChange}>
        {tabs.map((tab, idx) => (
          <Tab
            key={tab.id}
            label={
              (tab.props?.title as string | undefined) ??
              (tab.props?.label as string | undefined) ??
              `Tab ${idx + 1}`
            }
          />
        ))}
      </Tabs>
      <div style={{ paddingTop: 16 }}>
        {activeTab?.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}
      </div>
    </div>
  )
}
