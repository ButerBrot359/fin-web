import { useState, type FC } from 'react'
import { Button, Menu } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import { NodeRenderer } from '../../node-renderer'

export const ButtonNode: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const command = node.props?.command as string | undefined
  const enabled = (node.props?.enabled as boolean | undefined) ?? true
  const variantProp = node.props?.variant as string | undefined

  const dispatch = useSduiDispatch()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const isDropdown = variantProp === 'dropdown' && !!node.children?.length
  const muiVariant = variantProp === 'primary' ? 'contained' : 'outlined'

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDropdown) {
      setMenuAnchor(e.currentTarget)
      return
    }
    if (command) {
      void dispatch({ type: 'COMMAND', command })
    }
  }

  return (
    <>
      <Button
        variant={muiVariant}
        disabled={!enabled}
        onClick={handleClick}
      >
        {label}
      </Button>
      {isDropdown && (
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          {node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}
        </Menu>
      )}
    </>
  )
}
