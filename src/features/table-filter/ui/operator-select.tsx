import { useTranslation } from 'react-i18next'
import { MenuItem, TextField } from '@mui/material'

import type { FilterOp } from '@/entities/document-entry'

interface OperatorSelectProps {
  value: FilterOp
  onChange: (op: FilterOp) => void
  options: readonly FilterOp[]
}

export const OperatorSelect = ({
  value,
  onChange,
  options,
}: OperatorSelectProps) => {
  const { t } = useTranslation()
  return (
    <TextField
      select
      size="small"
      fullWidth
      label={t('tableFilter.operator')}
      value={value}
      onChange={(e) => {
        onChange(e.target.value as FilterOp)
      }}
    >
      {options.map((op) => (
        <MenuItem key={op} value={op}>
          {t(`tableFilter.ops.${op}`)}
        </MenuItem>
      ))}
    </TextField>
  )
}
