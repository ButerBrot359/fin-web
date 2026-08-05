import { useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, IconButton, Popover } from '@mui/material'
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined'

import {
  ListFilterValueControl,
  type ColumnFilterValueMeta,
} from './list-filter-value-control'

const VALUELESS_OPS = new Set(['isNull', 'isNotNull'])

export interface ListFilterFunnelColumn extends ColumnFilterValueMeta {
  filterField: string
  filterOps: string[]
}

export interface ListFilterFunnelProps {
  column: ListFilterFunnelColumn
  filterOpLabels?: Record<string, string>
  onApply: (field: string, op: string, value?: unknown) => void
}

// SCRUM-291 2c-a: воронка на заголовке колонки — иконка + popover (оператор из
// filterOps + контрол значения + Применить). Одно условие на колонку, шлётся
// list.applyFilter (сборка команды — на вызывающей стороне, list-node.tsx), см.
// design §2c. Лейблы операторов — с сервера (LIST.props.filterOpLabels), НЕ i18n.
export const ListFilterFunnel: FC<ListFilterFunnelProps> = ({
  column,
  filterOpLabels,
  onApply,
}) => {
  const { t } = useTranslation()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [op, setOp] = useState(column.filterOps[0])
  const [value, setValue] = useState<unknown>(undefined)

  if (column.filterOps.length === 0) return null

  const isValueless = VALUELESS_OPS.has(op)

  const handleApply = () => {
    onApply(column.filterField, op, isValueless ? undefined : value)
    setAnchorEl(null)
  }

  return (
    <>
      <IconButton
        size="small"
        aria-label={t('table.filter')}
        onClick={(e) => {
          e.stopPropagation()
          setAnchorEl(e.currentTarget)
        }}
        onMouseDown={(e) => {
          e.stopPropagation()
        }}
        sx={{ p: '2px' }}
      >
        <FilterAltOutlinedIcon fontSize="small" />
      </IconButton>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => {
          setAnchorEl(null)
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <div className="flex flex-col gap-2 p-3" style={{ minWidth: 220 }}>
          <select
            data-testid="filter-op-select"
            value={op}
            onChange={(e) => {
              setOp(e.target.value)
              setValue(undefined)
            }}
            className="h-9 rounded-md border border-ui-04 px-2 text-body2 text-ui-06"
          >
            {column.filterOps.map((opCode) => (
              <option key={opCode} value={opCode}>
                {filterOpLabels?.[opCode] ?? opCode}
              </option>
            ))}
          </select>
          {!isValueless && (
            <ListFilterValueControl
              op={op}
              column={column}
              value={value}
              onChange={setValue}
            />
          )}
          <Button variant="contained" size="small" onClick={handleApply}>
            {t('table.filterApply')}
          </Button>
        </div>
      </Popover>
    </>
  )
}
