import { Menu, MenuItem } from '@mui/material'

export interface ReportAltMenuPosition {
  top: number
  left: number
}

interface ReportAltRowMenuProps {
  position: ReportAltMenuPosition | null
  onClose: () => void
  openLabel: string | null
  onOpen: () => void
  accountCardLabel: string | null
  onOpenAccountCard: () => void
}

export const ReportAltRowMenu = ({
  position,
  onClose,
  openLabel,
  onOpen,
  accountCardLabel,
  onOpenAccountCard,
}: ReportAltRowMenuProps) => (
  <Menu
    open={position != null}
    onClose={onClose}
    anchorReference="anchorPosition"
    anchorPosition={
      position ? { top: position.top, left: position.left } : undefined
    }
  >
    {openLabel != null && (
      <MenuItem
        onClick={() => {
          onOpen()
          onClose()
        }}
      >
        {openLabel}
      </MenuItem>
    )}
    {accountCardLabel != null && (
      <MenuItem
        onClick={() => {
          onOpenAccountCard()
          onClose()
        }}
      >
        {accountCardLabel}
      </MenuItem>
    )}
  </Menu>
)
