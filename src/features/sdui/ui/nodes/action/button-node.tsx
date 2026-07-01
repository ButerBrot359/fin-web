import { useState, type FC } from 'react'
import { Button, Menu } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import {
  needsSelectedRow,
  refCommandField,
  useRefPickerSelection,
} from '../../../lib/stores/ref-picker-selection-store'
import { NodeRenderer } from '../../node-renderer'

export const ButtonNode: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const command = node.props?.command as string | undefined
  const enabled = (node.props?.enabled as boolean | undefined) ?? true
  const variantProp = node.props?.variant as string | undefined

  const dispatch = useSduiDispatch()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const usesSelectedRow = needsSelectedRow(command)
  const selectedRowId = useRefPickerSelection(
    usesSelectedRow ? refCommandField(command) : null,
  )

  const isDropdown = variantProp === 'dropdown' && !!node.children?.length
  const muiVariant = variantProp === 'primary' ? 'contained' : 'outlined'
  const disabled = !enabled || (usesSelectedRow && selectedRowId == null)

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDropdown) {
      setMenuAnchor(e.currentTarget)
      return
    }
    if (command) {
      if (usesSelectedRow) {
        if (selectedRowId == null) return
        void dispatch({
          type: 'COMMAND',
          command,
          value: { id: selectedRowId },
          sourceNodeId: node.id,
        })
        return
      }
      void dispatch({ type: 'COMMAND', command })
    }
  }

  return (
    <>
      <Button
        variant={muiVariant}
        disabled={disabled}
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
