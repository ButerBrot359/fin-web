import type { FC } from 'react'
import { Popover } from '@mui/material'

import { CalculatorPanel, type CalculatorPanelProps } from './calculator-panel'

interface CalculatorPopoverProps extends CalculatorPanelProps {
  anchorEl: Element | null
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
    anchorOrigin={{ vertical: 'center', horizontal: 'left' }}
    transformOrigin={{ vertical: 'center', horizontal: 'right' }}
    slotProps={{ paper: { sx: { borderRadius: '8px', ml: '-8px' } } }}
  >
    <CalculatorPanel {...panelProps} onCancel={onCancel} />
  </Popover>
)
