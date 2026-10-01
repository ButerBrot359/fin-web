import { Menu, MenuItem } from '@mui/material'

export interface ReportAltMenuPosition {
  top: number
  left: number
}

export interface ReportAltMenuItem {
  key: string
  label: string
  onClick: () => void
  /** Пункт виден, но недоступен — как серая команда меню 1С. */
  disabled?: boolean
}

interface ReportAltRowMenuProps {
  position: ReportAltMenuPosition | null
  onClose: () => void
  items: ReportAltMenuItem[]
}

export const ReportAltRowMenu = ({
  position,
  onClose,
  items,
}: ReportAltRowMenuProps) => (
  <Menu
    open={position != null && items.length > 0}
    onClose={onClose}
    anchorReference="anchorPosition"
    anchorPosition={
      position ? { top: position.top, left: position.left } : undefined
    }
  >
    {items.map((item) => (
      <MenuItem
        key={item.key}
        onClick={() => {
          item.onClick()
          onClose()
        }}
      >
        {item.label}
      </MenuItem>
    ))}
  </Menu>
)
