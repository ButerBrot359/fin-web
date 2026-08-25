import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { KalendariScheduleEditor, replaceDayRows } from './kalendari-schedule-editor'

const rows = [
  { rowId: 'day-1', NomerDnya: 1, VremyaNachala: '2000-01-01T09:00:00', VremyaOkonchaniya: '2000-01-01T18:00:00' },
  { rowId: 'day-2', NomerDnya: 2, VremyaNachala: '2000-01-01T10:00:00', VremyaOkonchaniya: '2000-01-01T17:00:00' },
]

describe('KalendariScheduleEditor', () => {
  it('replaces only the selected day and keeps the full snapshot for other days', () => {
    const onApply = vi.fn()
    render(<KalendariScheduleEditor open dayLabel="пн" dayNumber={1} allRows={rows} onApply={onApply} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'sdui.kalendari.apply' }))

    expect(onApply).toHaveBeenCalledWith(rows)
    expect(replaceDayRows(rows, 1, [])).toEqual([rows[1]])
  })

  it('rejects overlapping intervals without applying changes', () => {
    const onApply = vi.fn()
    render(<KalendariScheduleEditor open dayLabel="пн" dayNumber={1} allRows={[
      ...rows,
      { rowId: 'overlap', NomerDnya: 1, VremyaNachala: '2000-01-01T17:00:00', VremyaOkonchaniya: '2000-01-01T19:00:00' },
    ]} onApply={onApply} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'sdui.kalendari.apply' }))

    expect(screen.getByText('sdui.kalendari.overlappingIntervals')).toBeTruthy()
    expect(onApply).not.toHaveBeenCalled()
  })
})
