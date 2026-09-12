import { useState, type FC } from 'react'
import { IconButton, Tooltip } from '@mui/material'
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined'
import { useTranslation } from 'react-i18next'

import { CalculatorPopover } from '@/shared/ui/calculator'

interface NumberInputCalculatorProps {
  /** Текущее значение поля — с него начинается расчёт. */
  value: string
  precision?: number
  onApply: (value: number) => void
}

export const NumberInputCalculator: FC<NumberInputCalculatorProps> = ({
  value,
  precision,
  onApply,
}) => {
  const { t } = useTranslation()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  return (
    <>
      <Tooltip title={t('calculator.open')} enterDelay={400}>
        <IconButton
          size="small"
          edge="end"
          aria-label={t('calculator.open')}
          onClick={(e) => {
            setAnchorEl(e.currentTarget)
          }}
        >
          <CalculateOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {anchorEl && (
        <CalculatorPopover
          open
          anchorEl={anchorEl}
          initialExpression={value}
          precision={precision}
          onApply={(result) => {
            onApply(result)
            setAnchorEl(null)
          }}
          onCancel={() => {
            setAnchorEl(null)
          }}
        />
      )}
    </>
  )
}
