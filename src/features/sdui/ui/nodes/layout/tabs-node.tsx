import { useState } from 'react'
import type { FC } from 'react'
import { Tabs, Tab } from '@mui/material'

import type { NodeProps, ViewNode } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'
import { useSduiDispatch } from '../../../lib/dispatch'

export const TabsNode: FC<NodeProps> = ({ node }) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const dispatch = useSduiDispatch()

  // Условные вкладки (напр. «График платежей» по галке «Использовать график»).
  // SCRUM-362 B-4: visible эмитится бэком явно — строгая проверка вместо ?? true.
  const tabs = (node.children ?? []).filter((t) => t.props?.visible === true)

  const handleChange = (_: React.SyntheticEvent, newIndex: number) => {
    setActiveIndex(newIndex)

    const tabNode = tabs[newIndex] as ViewNode | undefined
    if (tabNode) {
      const fieldEventAction = tabNode.actions?.find(
        (a) => a.actionId === 'fieldEvent'
      )
      if (fieldEventAction) {
        void dispatch({
          type: 'EVENT',
          sourceNodeId: tabNode.id,
          trigger: fieldEventAction.trigger,
        })
      }
    }
  }

  // «ОтображениеСтраниц = TabsOnLeftHorizontal» в 1С: список разделов слева от
  // содержимого. Единственный такой узел в конфигурации — 15 разделов ЭСФ, и
  // сверху они не помещаются. Отсутствие пропа = прежнее поведение (сверху).
  const isLeft = node.props?.tabsPlacement === 'LEFT'

  // Клампим индекс: условная вкладка могла исчезнуть и сдвинуть длину списка.
  const safeIndex =
    tabs.length === 0 ? 0 : Math.min(activeIndex, tabs.length - 1)
  const activeTab = tabs[safeIndex] as ViewNode | undefined

  const tabList = (
    <Tabs
      value={safeIndex}
      onChange={handleChange}
      orientation={isLeft ? 'vertical' : 'horizontal'}
      // scrollable: 15 разделов ЭСФ не помещаются в высоту без прокрутки, а
      // горизонтальные вкладки прокручиваются и сейчас по ширине окна.
      variant="scrollable"
      scrollButtons="auto"
      sx={
        isLeft
          ? {
              borderRight: 1,
              borderColor: 'divider',
              flex: '0 0 auto',
              // Подписи разделов длинные («A. Общий раздел») — выравниваем по
              // левому краю, иначе список читается как набор центрированных
              // обрывков.
              '& .MuiTab-root': { alignItems: 'flex-start', textAlign: 'left' },
            }
          : undefined
      }
    >
      {tabs.map((tab, idx) => (
        <Tab
          key={tab.id}
          label={
            (tab.props?.title as string | undefined) ??
            (tab.props?.label as string | undefined) ??
            `Tab ${String(idx + 1)}`
          }
        />
      ))}
    </Tabs>
  )

  const content = (
    <div
      style={
        isLeft
          ? { paddingLeft: 16, flex: '1 1 0%', minWidth: 0 }
          : { paddingTop: 16 }
      }
    >
      {activeTab?.children?.map((c) => (
        <NodeRenderer key={c.id} node={c} />
      ))}
    </div>
  )

  return (
    <div
      style={isLeft ? { display: 'flex', alignItems: 'flex-start' } : undefined}
    >
      {tabList}
      {content}
    </div>
  )
}
