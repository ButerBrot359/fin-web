import { useState } from 'react'
import type { FC } from 'react'
import { Paper, Typography, Collapse, IconButton } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'

import type { NodeProps } from '../../../types/view'
import { resolveStackGap } from '../../../lib/utils/resolve-stack-gap'
import {
  LABEL_SCOPE_ATTR,
  useGroupLabelColumn,
} from '../../../lib/hooks/use-group-label-column'
import { NodeRenderer } from '../../node-renderer'
import { GroupColumnsContext } from './group-columns-context'

export const GroupNode: FC<NodeProps> = ({ node }) => {
  const title = node.props?.title as string | undefined
  const collapsible = node.props?.collapsible as boolean | undefined
  const gap = node.props?.gap as number | undefined
  // SCRUM-355 §5: сколько равных колонок держит группа. Отсутствие пропа
  // обязано сохранять прежнее поведение (одна колонка потоком).
  const columnsCount = node.props?.columnsCount as number | undefined
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

  // SCRUM-355 §8.7: общая колонка подписей labelPlacement-полей этой группы
  const hostRef = useGroupLabelColumn()

  const collapsed = userCollapsed ?? serverCollapsed
  const toggle = () => {
    setUserCollapsed(!collapsed)
  }

  const children = node.children?.map((c) => (
    <NodeRenderer key={c.id} node={c} />
  ))

  const body = (
    <div
      style={
        columnsCount !== undefined && columnsCount > 1
          ? {
              display: 'grid',
              gridTemplateColumns: `repeat(${String(columnsCount)}, minmax(0, 1fr))`,
              gap: resolveStackGap(gap),
            }
          : {
              display: 'flex',
              flexDirection: 'column',
              gap: resolveStackGap(gap),
            }
      }
    >
      {children}
    </div>
  )

  return (
    <Paper
      variant="outlined"
      style={{ padding: 16 }}
      ref={hostRef}
      {...{ [LABEL_SCOPE_ATTR]: '' }}
    >
      {(title || collapsible) && (
        // SCRUM-355 §8.7: у сворачиваемой группы переключателем служит ВСЯ
        // строка заголовка (Enter/Space с клавиатуры), а не только стрелка.
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            // Figma (аудит Ф3): заголовок секции → контент = 16px
            marginBottom: collapsed ? 0 : 16,
            cursor: collapsible ? 'pointer' : undefined,
          }}
          role={collapsible ? 'button' : undefined}
          tabIndex={collapsible ? 0 : undefined}
          aria-expanded={collapsible ? !collapsed : undefined}
          onClick={collapsible ? toggle : undefined}
          onKeyDown={
            collapsible
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggle()
                  }
                }
              : undefined
          }
        >
          {title && (
            <Typography variant="subtitle2" style={{ flex: 1 }}>
              {title}
            </Typography>
          )}
          {collapsible && (
            // Стрелка остаётся: и привычная цель клика, и индикатор состояния.
            // tabIndex -1 — фокус ходит по строке, не дважды по одному месту.
            <IconButton size="small" tabIndex={-1}>
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
        {columnsCount !== undefined && columnsCount > 1 ? (
          <GroupColumnsContext value={columnsCount}>{body}</GroupColumnsContext>
        ) : (
          body
        )}
      </Collapse>
    </Paper>
  )
}
