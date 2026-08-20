import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'
import { isNodeVisible } from '../../../lib/utils/node-visibility'

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
      {/* Скрытых детей отсеиваем здесь, а не только в NodeRenderer: обёртка
          ниже — собственный DOM-узел с flex:1, и от невидимого ребёнка
          осталась бы пустая колонка. */}
      {node.children?.filter(isNodeVisible).map((c) => (
        // Равное деление ширины по умолчанию (SCRUM-282 #1): без flex дети
        // ужимаются до контента (таблицы «скомканы»). minWidth:0 обязателен,
        // иначе таблица не даёт контейнеру сжиматься и появляется h-скролл формы.
        // Колонка — flex-контейнер: сама обёртка растянута до высоты самой
        // высокой соседки (align-items:stretch), и ребёнок со своим flexGrow
        // добирает эту высоту. Без этого master-detail пара таблиц заканчивается
        // на разных линиях — у каждой Paper высота по своему содержимому.
        <div
          key={c.id}
          style={{
            flex: (c.props?.flex as number | string | undefined) ?? '1 1 0%',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <NodeRenderer node={c} />
        </div>
      ))}
    </div>
  )
}
