import type { FC } from 'react'
import { IconButton, MenuItem, Select } from '@mui/material'

const FORWARD_SPAN = 5 // при maxYear=null окно дропдауна вперёд

// SCRUM-362 B-2: новые ключи контракта (year/minYear/maxYear вместо
// легаси-транслита god/godMin/godMax).
export interface YearSelectorProps {
  year: number
  minYear?: number | null
  maxYear?: number | null
  onChange: (year: number) => void
}

export const YearSelector: FC<YearSelectorProps> = ({
  year,
  minYear,
  maxYear,
  onChange,
}) => {
  const min = minYear ?? year - FORWARD_SPAN
  const max = maxYear ?? year + FORWARD_SPAN
  const years: number[] = []
  for (let y = min; y <= max; y++) years.push(y)

  const canPrev = minYear == null || year > minYear
  const canNext = maxYear == null || year < maxYear

  return (
    <div className="flex items-center gap-2">
      <IconButton
        size="small"
        aria-label="prev-year"
        disabled={!canPrev}
        onClick={() => {
          onChange(year - 1)
        }}
      >
        ‹
      </IconButton>
      <Select
        size="small"
        value={year}
        onChange={(e) => {
          onChange(e.target.value)
        }}
      >
        {years.map((y) => (
          <MenuItem key={y} value={y}>
            {y}
          </MenuItem>
        ))}
      </Select>
      <IconButton
        size="small"
        aria-label="next-year"
        disabled={!canNext}
        onClick={() => {
          onChange(year + 1)
        }}
      >
        ›
      </IconButton>
    </div>
  )
}
