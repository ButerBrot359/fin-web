import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, Popover, Typography } from '@mui/material'

import type {
  ColumnMetaDto,
  FilterCondition,
  FilterOp,
} from '@/entities/document-entry'
import { resolveAllowedOps } from '@/shared/lib/filter/default-allowed-ops'
import { isConditionValid } from '@/shared/lib/filter/validate-condition'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import { OperatorSelect } from './operator-select'
import { ValueControl } from './value-controls'
import { resetValueForOp } from './value-controls.utils'

interface ColumnFilterPopoverProps {
  anchorEl: HTMLElement | null
  column: ColumnMetaDto
  initial: FilterCondition | null
  onApply: (condition: FilterCondition) => void
  onClear: () => void
  onClose: () => void
}

export const ColumnFilterPopover = ({
  anchorEl,
  column,
  initial,
  onApply,
  onClear,
  onClose,
}: ColumnFilterPopoverProps) => {
  const { t, i18n } = useTranslation()

  const allowedOps = useMemo(
    () => resolveAllowedOps(column.dataType, column.allowedOps),
    [column.dataType, column.allowedOps]
  )

  const [op, setOp] = useState<FilterOp>(
    initial?.op ?? allowedOps.at(0) ?? 'eq'
  )
  const [value, setValue] = useState<unknown>(initial?.value)

  useEffect(() => {
    if (!anchorEl) return
    const nextOp = initial?.op ?? allowedOps.at(0) ?? 'eq'
    setOp(nextOp)
    setValue(initial?.value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorEl])

  if (allowedOps.length === 0) return null

  const handleOpChange = (next: FilterOp) => {
    setOp(next)
    setValue((prev: unknown) => resetValueForOp(next, prev))
  }

  const candidate: FilterCondition = { field: column.code, op, value }
  const canApply = isConditionValid(candidate)

  const handleApply = () => {
    if (!canApply) return
    onApply(candidate)
    onClose()
  }

  const handleClear = () => {
    onClear()
    onClose()
  }

  return (
    <Popover
      open={!!anchorEl}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{ paper: { sx: { p: 2.5, minWidth: 340, maxWidth: 480 } } }}
    >
      <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.primary' }}>
        {t('tableFilter.filterBy', {
          name: getLocalizedName(column, i18n.language),
        })}
      </Typography>

      <Box className="flex flex-col gap-4">
        <OperatorSelect value={op} onChange={handleOpChange} options={allowedOps} />
        <ValueControl
          column={column}
          op={op}
          value={value}
          onChange={setValue}
        />
      </Box>

      <Box className="flex justify-end gap-2" sx={{ mt: 2.5 }}>
        {initial && (
          <Button onClick={handleClear} color="warning">
            {t('tableFilter.clear')}
          </Button>
        )}
        <Button onClick={onClose}>{t('tableFilter.cancel')}</Button>
        <Button variant="contained" disabled={!canApply} onClick={handleApply}>
          {t('tableFilter.apply')}
        </Button>
      </Box>
    </Popover>
  )
}
