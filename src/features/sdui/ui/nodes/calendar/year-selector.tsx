import type { FC } from 'react'
import { IconButton, MenuItem, Select } from '@mui/material'

const FORWARD_SPAN = 5 // при godMax=null окно дропдауна вперёд

export interface YearSelectorProps {
  god: number
  godMin?: number | null
  godMax?: number | null
  onChange: (year: number) => void
}

export const YearSelector: FC<YearSelectorProps> = ({ god, godMin, godMax, onChange }) => {
  const min = godMin ?? god - FORWARD_SPAN
  const max = godMax ?? god + FORWARD_SPAN
  const years: number[] = []
  for (let y = min; y <= max; y++) years.push(y)

  const canPrev = godMin == null || god > godMin
  const canNext = godMax == null || god < godMax

  return (
    <div className="flex items-center gap-2">
      <IconButton
        size="small"
        aria-label="prev-year"
        disabled={!canPrev}
        onClick={() => onChange(god - 1)}
      >
        ‹
      </IconButton>
      <Select
        size="small"
        value={god}
        onChange={(e) => onChange(Number(e.target.value))}
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
        onClick={() => onChange(god + 1)}
      >
        ›
      </IconButton>
    </div>
  )
}
