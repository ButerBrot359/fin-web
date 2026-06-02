import { useState } from 'react'
import type { FC } from 'react'
import { Paper, Typography, Collapse, IconButton } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'

import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

export const GroupNode: FC<NodeProps> = ({ node }) => {
  const title = node.props?.title as string | undefined
  const collapsible = node.props?.collapsible as boolean | undefined
  const initialCollapsed = node.props?.collapsed as boolean | undefined

  const [collapsed, setCollapsed] = useState(initialCollapsed ?? false)

  return (
    <Paper variant="outlined" style={{ padding: 16 }}>
      {(title || collapsible) && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: collapsed ? 0 : 8 }}>
          {title && (
            <Typography variant="subtitle2" style={{ flex: 1 }}>
              {title}
            </Typography>
          )}
          {collapsible && (
            <IconButton size="small" onClick={() => setCollapsed((prev) => !prev)}>
              {collapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
            </IconButton>
          )}
        </div>
      )}
      <Collapse in={!collapsed}>
        {node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}
      </Collapse>
    </Paper>
  )
}
