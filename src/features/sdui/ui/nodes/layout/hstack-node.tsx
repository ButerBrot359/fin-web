import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

export const HStackNode: FC<NodeProps> = ({ node }) => {
  const gap = (node.props?.gap as number | undefined) ?? 0
  const justify = (node.props?.justify as string | undefined) ?? 'flex-start'
  const align = (node.props?.align as string | undefined) ?? 'stretch'
  const flex = node.props?.flex as number | string | undefined

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: gap * 4,
        justifyContent: justify,
        alignItems: align,
        flex: flex !== undefined ? flex : undefined,
      }}
    >
      {node.children?.map((c) => (
        // Равное деление ширины по умолчанию (SCRUM-282 #1): без flex дети
        // ужимаются до контента (таблицы «скомканы»). minWidth:0 обязателен,
        // иначе таблица не даёт контейнеру сжиматься и появляется h-скролл формы.
        <div
          key={c.id}
          style={{
            flex: (c.props?.flex as number | string | undefined) ?? '1 1 0%',
            minWidth: 0,
          }}
        >
          <NodeRenderer node={c} />
        </div>
      ))}
    </div>
  )
}
