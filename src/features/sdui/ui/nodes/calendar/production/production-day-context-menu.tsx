import type { FC } from 'react'
import { Menu, MenuItem } from '@mui/material'
import { useTranslation } from 'react-i18next'

export interface ProductionDayContextMenuProps {
  position: { left: number; top: number } | null
  canChangeDay: boolean
  canTransferDay: boolean
  onChangeDay: () => void
  onTransferDay: () => void
  onClose: () => void
}

// Контекстное меню дня (§5.1): те же change/transfer workflow, что и toolbar.
export const ProductionDayContextMenu: FC<ProductionDayContextMenuProps> = ({
  position,
  canChangeDay,
  canTransferDay,
  onChangeDay,
  onTransferDay,
  onClose,
}) => {
  const { t } = useTranslation()

  return (
    <Menu
      open={position != null}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={position ?? undefined}
    >
      <MenuItem disabled={!canChangeDay} onClick={onChangeDay}>
        {t('sdui.productionCalendar.changeDay')}
      </MenuItem>
      <MenuItem disabled={!canTransferDay} onClick={onTransferDay}>
        {t('sdui.productionCalendar.transferDay')}
      </MenuItem>
    </Menu>
  )
}
