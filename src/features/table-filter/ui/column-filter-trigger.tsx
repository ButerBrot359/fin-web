import { useMemo, useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton, Tooltip } from '@mui/material'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOutlined'

import type { ColumnMetaDto, FilterCondition } from '@/entities/document-entry'
import { resolveAllowedOps } from '@/shared/lib/filter/default-allowed-ops'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import { useTableFilterStore, useTableFilters } from '../lib/hooks/use-table-filter-store'
import { ColumnFilterPopover } from './column-filter-popover'

interface ColumnFilterTriggerProps {
  tableId: string
  column: ColumnMetaDto
}

export const ColumnFilterTrigger = ({
  tableId,
  column,
}: ColumnFilterTriggerProps) => {
  const { t, i18n } = useTranslation()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const setFilter = useTableFilterStore((s) => s.setFilter)
  const removeFilter = useTableFilterStore((s) => s.removeFilter)
  const filters = useTableFilters(tableId)
  const current = filters.find((c) => c.field === column.code) ?? null

  const allowedOps = useMemo(() => resolveAllowedOps(column), [column])

  if (allowedOps.length === 0) return null

  const isActive = !!current
  const localizedName = getLocalizedName(column, i18n.language)

  const handleOpen = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation()
    setAnchorEl(e.currentTarget)
  }

  const handleApply = (condition: FilterCondition) => {
    setFilter(tableId, column.code, condition)
  }

  const handleClear = () => {
    removeFilter(tableId, column.code)
  }

  return (
    <>
      <Tooltip title={t('tableFilter.filterBy', { name: localizedName })}>
        <IconButton
          size="small"
          onClick={handleOpen}
          onMouseDown={(e) => {
            e.stopPropagation()
          }}
          color={isActive ? 'primary' : 'default'}
          sx={{ p: '2px' }}
        >
          {isActive ? (
            <FilterAltIcon fontSize="small" />
          ) : (
            <FilterAltOffIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
      <ColumnFilterPopover
        anchorEl={anchorEl}
        column={column}
        initial={current}
        onApply={handleApply}
        onClear={handleClear}
        onClose={() => {
          setAnchorEl(null)
        }}
      />
    </>
  )
}
