import { useState, type FC, type ReactNode } from 'react'
import { Button, Menu, Tooltip } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import {
  needsSelectedRow,
  refCommandField,
  useRefPickerSelection,
} from '../../../lib/stores/ref-picker-selection-store'
import { NodeRenderer } from '../../node-renderer'
import { resolveButtonIcon } from './button-icons'

export const ButtonNode: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const command = node.props?.command as string | undefined
  const enabled = (node.props?.enabled as boolean | undefined) ?? true
  const variantProp = node.props?.variant as string | undefined
  const iconName = node.props?.icon as string | undefined
  const tooltip = node.props?.tooltip as string | undefined

  const dispatch = useSduiDispatch()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const usesSelectedRow = needsSelectedRow(command)
  const selectedRowId = useRefPickerSelection(
    usesSelectedRow ? refCommandField(command) : null,
  )

  const isDropdown = variantProp === 'dropdown' && !!node.children?.length
  const muiVariant = variantProp === 'primary' ? 'contained' : 'outlined'
  const disabled = !enabled || (usesSelectedRow && selectedRowId == null)

  const icon = resolveButtonIcon(iconName)
  const isIconOnly = !!icon && !label
  // icon-only: глиф в line-box высоты текстовой строки (1.75em), иначе
  // голый 20px svg делает кнопку ~4px ниже соседних текстовых.
  const content: ReactNode = isIconOnly ? (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', height: '1.75em' }}
    >
      {icon}
    </span>
  ) : (
    // Неизвестная иконка → fallback: label, затем command (кнопка не пустая)
    (icon ?? label ?? command ?? '')
  )
  const ariaLabel = isIconOnly ? (tooltip ?? command ?? undefined) : undefined

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

  const buttonEl = (
    <Button
      variant={muiVariant}
      disabled={disabled}
      onClick={handleClick}
      aria-label={ariaLabel}
      sx={isIconOnly ? { minWidth: 0, px: 1 } : undefined}
    >
      {content}
    </Button>
  )

  return (
    <>
      {tooltip ? (
        // span-обёртка обязательна: без неё tooltip не работает на disabled-кнопке
        <Tooltip title={tooltip}>
          <span style={{ display: 'inline-flex' }}>{buttonEl}</span>
        </Tooltip>
      ) : (
        buttonEl
      )}
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
