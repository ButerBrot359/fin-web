import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, Chip, Typography } from '@mui/material'

import type { ColumnMetaDto } from '@/entities/document-entry'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import { useTableFilterStore, useTableFilters } from '../lib/hooks/use-table-filter-store'
import { formatChipValue } from '../lib/utils/format-chip-value'

interface ActiveFiltersBarProps {
  tableId: string
  columns: ColumnMetaDto[]
}

export const ActiveFiltersBar = ({ tableId, columns }: ActiveFiltersBarProps) => {
  const { t, i18n } = useTranslation()
  const filters = useTableFilters(tableId)
  const removeFilter = useTableFilterStore((s) => s.removeFilter)
  const clearAll = useTableFilterStore((s) => s.clearAll)

  const columnByCode = useMemo(() => {
    const map = new Map<string, ColumnMetaDto>()
    columns.forEach((c) => {
      map.set(c.code, c)
    })
    return map
  }, [columns])

  if (filters.length === 0) return null

  return (
    <Box
      className="flex items-center flex-wrap gap-2 px-3 py-2 border-b border-ui-04 bg-ui-01"
      role="region"
      aria-label={t('tableFilter.activeTitle')}
    >
      <Typography variant="body2" className="text-ui-05 mr-1">
        {t('tableFilter.activeTitle')}:
      </Typography>

      {filters.map((cond) => {
        const column = columnByCode.get(cond.field)
        const name = column
          ? getLocalizedName(column, i18n.language)
          : cond.field
        const opLabel = t(`tableFilter.ops.${cond.op}`)
        const valLabel = column ? formatChipValue(cond, column) : ''
        const label = valLabel
          ? `${name} ${opLabel}: ${valLabel}`
          : `${name}: ${opLabel}`

        return (
          <Chip
            key={cond.field}
            size="small"
            color="primary"
            variant="outlined"
            label={label}
            onDelete={() => {
              removeFilter(tableId, cond.field)
            }}
            aria-label={t('tableFilter.removeChip')}
          />
        )
      })}

      <Box className="ml-auto">
        <Button
          size="small"
          color="warning"
          onClick={() => {
            clearAll(tableId)
          }}
        >
          {t('tableFilter.clearAll')}
        </Button>
      </Box>
    </Box>
  )
}
