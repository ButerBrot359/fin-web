import { useState } from 'react'
import type { FC } from 'react'
import { Paper, Typography, Collapse, IconButton } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'

import type { NodeProps } from '../../../types/view'
import { resolveStackGap } from '../../../lib/utils/resolve-stack-gap'
import { NodeRenderer } from '../../node-renderer'

export const GroupNode: FC<NodeProps> = ({ node }) => {
  const title = node.props?.title as string | undefined
  const collapsible = node.props?.collapsible as boolean | undefined
  const gap = node.props?.gap as number | undefined
  const serverCollapsed =
    (node.props?.collapsed as boolean | undefined) ?? false

  // Сворачивание двухисточниковое: бэк задаёт состояние (стартовое дерево и
  // рантайм-патч setProp «collapsed» — так отчёт схлопывает группу параметров
  // после «Сформировать»), пользователь поверх этого может развернуть группу
  // руками. Локальный выбор живёт в userCollapsed и перебивает серверный, пока
  // бэк не выскажется заново.
  const [userCollapsed, setUserCollapsed] = useState<boolean | null>(null)

  // Сигнал «бэк высказался» — новый объект props у ЭТОГО узла. setProp собирает
  // его только для адресата патча (patch-applier: предкам пересобираются лишь
  // children, ссылка на props сохраняется), поэтому сброс не ловит чужие патчи.
  // Сравнение по идентичности, а не по значению: повторная команда с тем же
  // collapsed=true обязана снова схлопнуть группу, которую развернули руками.
  const [seenProps, setSeenProps] = useState(node.props)
  if (seenProps !== node.props) {
    setSeenProps(node.props)
    setUserCollapsed(null)
  }

  const collapsed = userCollapsed ?? serverCollapsed

  const children = node.children?.map((c) => (
    <NodeRenderer key={c.id} node={c} />
  ))

  return (
    <Paper variant="outlined" style={{ padding: 16 }}>
      {(title || collapsible) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            // Figma (аудит Ф3): заголовок секции → контент = 16px
            marginBottom: collapsed ? 0 : 16,
          }}
        >
          {title && (
            <Typography variant="subtitle2" style={{ flex: 1 }}>
              {title}
            </Typography>
          )}
          {collapsible && (
            <IconButton
              size="small"
              onClick={() => {
                setUserCollapsed(!collapsed)
              }}
            >
              {collapsed ? (
                <ExpandMoreIcon fontSize="small" />
              ) : (
                <ExpandLessIcon fontSize="small" />
              )}
            </IconButton>
          )}
        </div>
      )}
      <Collapse in={!collapsed}>
        {/* gap трактуется как у VSTACK (нормализация resolveStackGap): группа,
            приезжающая GROUP'ом вместо VSTACK ради заголовка, держит тот же
            ритм 16px между детьми и без пропа с провода. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: resolveStackGap(gap),
          }}
        >
          {children}
        </div>
      </Collapse>
    </Paper>
  )
}
