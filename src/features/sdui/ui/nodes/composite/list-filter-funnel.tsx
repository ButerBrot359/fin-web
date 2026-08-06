import { useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, IconButton, Popover } from '@mui/material'
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined'

import {
  ListFilterValueControl,
  type ColumnFilterValueMeta,
} from './list-filter-value-control'

const VALUELESS_OPS = new Set(['isNull', 'isNotNull'])

// Пустое значение — value-контрол ещё не тронут (undefined/null/'') — от реального
// «0» отличаем: 0 — валидное числовое значение, не «пусто».
const isEmptyValue = (v: unknown): boolean =>
  v === undefined || v === null || v === ''

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

  // Apply заблокирован, пока оператор требует значение, а его нет — иначе
  // onApply(field, op, undefined) уходит в list-node без ключа `value`, и на
  // проводе получается тот же вид команды, что зарезервирован под isNull/isNotNull
  // (баг: "contains" без значения неотличим от «поле пусто»).
  const isArrayOp = op === 'in' || op === 'notIn'
  const canApply = isValueless
    ? true
    : isArrayOp
      ? Array.isArray(value) && value.length > 0
      : op === 'between'
        ? Array.isArray(value) &&
          value.length === 2 &&
          !isEmptyValue(value[0]) &&
          !isEmptyValue(value[1])
        : !isEmptyValue(value)

  const handleApply = () => {
    if (!canApply) return
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
            aria-label={t('table.filterOperator')}
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
          <Button
            variant="contained"
            size="small"
            disabled={!canApply}
            onClick={handleApply}
          >
            {t('table.filterApply')}
          </Button>
        </div>
      </Popover>
    </>
  )
}
