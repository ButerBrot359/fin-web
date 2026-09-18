import { useTranslation } from 'react-i18next'
import { Box, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material'

import type { ColumnMetaDto, FilterOp } from '@/shared/lib/eav'
import { DateTimeInput } from '@/shared/ui/inputs/datetime-input'
import { NumberInput } from '@/shared/ui/inputs/number-input'

import { normalizeDateForBackend } from '../lib/utils/normalize-date-value'
import { getEdgeForOp } from '../lib/utils/edge-for-op'

export interface ValueControlProps {
  column: ColumnMetaDto
  op: FilterOp
  value: unknown
  onChange: (next: unknown) => void
}

export const StringControl = ({ value, onChange }: ValueControlProps) => {
  const { t } = useTranslation()
  return (
    <TextField
      fullWidth
      label={t('tableFilter.value')}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => {
        onChange(e.target.value)
      }}
    />
  )
}

export const StringListControl = ({ value, onChange }: ValueControlProps) => {
  const { t } = useTranslation()
  const raw = Array.isArray(value) ? value.join(', ') : ''
  return (
    <TextField
      fullWidth
      label={t('tableFilter.value')}
      placeholder="a, b, c"
      value={raw}
      onChange={(e) => {
        const parts = e.target.value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        onChange(parts)
      }}
    />
  )
}

export const NumberControl = ({
  value,
  onChange,
  column,
}: ValueControlProps) => {
  const { t } = useTranslation()
  return (
    <NumberInput
      fullWidth
      label={t('tableFilter.value')}
      decimal={column.dataType === 'DECIMAL'}
      value={
        typeof value === 'number'
          ? String(value)
          : typeof value === 'string'
            ? value
            : ''
      }
      onChange={(e) => {
        const v = (e.target as HTMLInputElement).value
        onChange(v === '' ? null : Number(v))
      }}
    />
  )
}

export const NumberRangeControl = ({
  value,
  onChange,
  column,
}: ValueControlProps) => {
  const { t } = useTranslation()
  const [from, to] = Array.isArray(value) ? value : [null, null]
  return (
    <Box className="flex gap-3">
      <NumberInput
        fullWidth
        label={t('tableFilter.valueFrom')}
        decimal={column.dataType === 'DECIMAL'}
        value={from == null ? '' : String(from)}
        onChange={(e) => {
          const v = (e.target as HTMLInputElement).value
          onChange([v === '' ? null : Number(v), to ?? null])
        }}
      />
      <NumberInput
        fullWidth
        label={t('tableFilter.valueTo')}
        decimal={column.dataType === 'DECIMAL'}
        value={to == null ? '' : String(to)}
        onChange={(e) => {
          const v = (e.target as HTMLInputElement).value
          onChange([from ?? null, v === '' ? null : Number(v)])
        }}
      />
    </Box>
  )
}

export const DateControl = ({
  value,
  op,
  onChange,
  column,
}: ValueControlProps) => {
  const { t } = useTranslation()
  const edge = getEdgeForOp(op)
  return (
    <DateTimeInput
      dateOnly
      label={t('tableFilter.value')}
      value={typeof value === 'string' ? value : ''}
      onChange={(v) => {
        onChange(normalizeDateForBackend(v, column.dataType, edge))
      }}
    />
  )
}

export const DateRangeControl = ({
  value,
  onChange,
  column,
}: ValueControlProps) => {
  const { t } = useTranslation()
  const [from, to] = Array.isArray(value) ? value : ['', '']
  return (
    <Box className="flex gap-3">
      <DateTimeInput
        dateOnly
        label={t('tableFilter.valueFrom')}
        value={typeof from === 'string' ? from : ''}
        onChange={(v) => {
          onChange([
            normalizeDateForBackend(v, column.dataType, 'start'),
            to ?? '',
          ])
        }}
      />
      <DateTimeInput
        dateOnly
        label={t('tableFilter.valueTo')}
        value={typeof to === 'string' ? to : ''}
        onChange={(v) => {
          onChange([
            from ?? '',
            normalizeDateForBackend(v, column.dataType, 'end'),
          ])
        }}
      />
    </Box>
  )
}

export const BooleanControl = ({ value, onChange }: ValueControlProps) => {
  const { t } = useTranslation()
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={value === null || value === undefined ? null : value}
      onChange={(_e, next) => {
        if (next === null) return
        onChange(next)
      }}
    >
      <ToggleButton value={true}>{t('tableFilter.yes')}</ToggleButton>
      <ToggleButton value={false}>{t('tableFilter.no')}</ToggleButton>
    </ToggleButtonGroup>
  )
}
