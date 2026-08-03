import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Divider,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material'

import type { TableCommandDescriptor } from '../../../types/view'

// Подписи хоткеев — непереводимые обозначения клавиш, не текст интерфейса
const HOTKEYS = {
  add: 'Ins',
  copy: 'F9',
  remove: 'Del',
  moveUp: 'Ctrl+Shift+↑',
  moveDown: 'Ctrl+Shift+↓',
}

export interface TableMoreMenuProps {
  anchorEl: HTMLElement | null
  onClose: () => void
  allowAdd: boolean
  allowDelete: boolean
  allowReorder: boolean
  canAdd: boolean
  canCopy: boolean
  canRemove: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onAdd: () => void
  onCopy: () => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  commands: TableCommandDescriptor[]
  commandLabel: (cmd: TableCommandDescriptor) => string
  onCommand: (cmd: TableCommandDescriptor) => void
}

export const TableMoreMenu = ({
  anchorEl,
  onClose,
  allowAdd,
  allowDelete,
  allowReorder,
  canAdd,
  canCopy,
  canRemove,
  canMoveUp,
  canMoveDown,
  onAdd,
  onCopy,
  onRemove,
  onMoveUp,
  onMoveDown,
  commands,
  commandLabel,
  onCommand,
}: TableMoreMenuProps) => {
  const { t } = useTranslation()
  const menuCommands = commands.filter((cmd) => cmd.inMoreMenu === true)

  const item = (
    key: string,
    label: ReactNode,
    hotkey: string | null,
    disabled: boolean,
    onClick: () => void
  ) => (
    <MenuItem
      key={key}
      disabled={disabled}
      onClick={() => {
        onClose()
        onClick()
      }}
    >
      <ListItemText>{label}</ListItemText>
      {hotkey && (
        <Typography variant="body2" color="text.secondary" sx={{ ml: 3 }}>
          {hotkey}
        </Typography>
      )}
    </MenuItem>
  )

  return (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
      {item('add', t('table.add'), HOTKEYS.add, !allowAdd || !canAdd, onAdd)}
      {item(
        'copy',
        t('table.copyRow'),
        HOTKEYS.copy,
        !allowAdd || !canCopy,
        onCopy
      )}
      {item(
        'remove',
        t('table.deleteRow'),
        HOTKEYS.remove,
        !allowDelete || !canRemove,
        onRemove
      )}
      {item(
        'moveUp',
        t('table.moveUp'),
        HOTKEYS.moveUp,
        !allowReorder || !canMoveUp,
        onMoveUp
      )}
      {item(
        'moveDown',
        t('table.moveDown'),
        HOTKEYS.moveDown,
        !allowReorder || !canMoveDown,
        onMoveDown
      )}
      {menuCommands.length > 0 && <Divider />}
      {menuCommands.map((cmd) =>
        item(cmd.command, commandLabel(cmd), null, !cmd.enabled, () => {
          onCommand(cmd)
        })
      )}
    </Menu>
  )
}
