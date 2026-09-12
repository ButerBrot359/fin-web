import type { FC } from 'react'
import { Popover } from '@mui/material'

import { CalculatorPanel, type CalculatorPanelProps } from './calculator-panel'

interface CalculatorPopoverProps extends CalculatorPanelProps {
  anchorEl: HTMLElement | null
  open: boolean
}

export const CalculatorPopover: FC<CalculatorPopoverProps> = ({
  anchorEl,
  open,
  onCancel,
  ...panelProps
}) => (
  <Popover
    open={open}
    anchorEl={anchorEl}
    onClose={onCancel}
    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    slotProps={{ paper: { sx: { borderRadius: '8px' } } }}
  >
    <CalculatorPanel {...panelProps} onCancel={onCancel} />
  </Popover>
)
