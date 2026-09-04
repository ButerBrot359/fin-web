import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { resolveStackGap } from '../../../lib/utils/resolve-stack-gap'
import { NodeRenderer } from '../../node-renderer'

export const VStackNode: FC<NodeProps> = ({ node }) => {
  // props.padding с провода игнорируется: боковые отступы контента задают
  // PAGE/панель (карта уже даёт p-8); единственный конфиг с padding —
  // Kalendari (padding:16 → двойной отступ, поля не на уровне тулбара).
  const gap = resolveStackGap(node.props?.gap as number | undefined)
  const align = (node.props?.align as string | undefined) ?? 'stretch'
  const flex = node.props?.flex as number | string | undefined

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap,
        alignItems: align,
        flex: flex !== undefined ? flex : undefined,
        minHeight: flex !== undefined ? 0 : undefined,
      }}
    >
      {node.children?.map((c) =>
        // Layout-проп pinBottom (спека конструктора дизайна, v2): блок
        // прижимается к низу стека растущим зазором — «Комментарий/
        // Ответственный» у нижней кромки формы без хардкода экрана.
        c.props?.pinBottom === true ? (
          <div key={c.id} style={{ marginTop: 'auto' }}>
            <NodeRenderer node={c} />
          </div>
        ) : (
          <NodeRenderer key={c.id} node={c} />
        )
      )}
    </div>
  )
}
