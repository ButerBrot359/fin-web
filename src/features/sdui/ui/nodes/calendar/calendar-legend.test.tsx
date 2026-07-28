import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import { CalendarLegend } from './calendar-legend'

afterEach(cleanup)

describe('CalendarLegend', () => {
  it('рендерит три подписи состояний', () => {
    render(<CalendarLegend />)
    expect(screen.getByText('sdui.calendar.legend.working')).toBeTruthy()
    expect(screen.getByText('sdui.calendar.legend.nonWorking')).toBeTruthy()
    expect(screen.getByText('sdui.calendar.legend.manual')).toBeTruthy()
  })
})
