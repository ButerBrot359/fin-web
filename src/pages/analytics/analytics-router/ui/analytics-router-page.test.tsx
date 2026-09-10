import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { AnalyticsRouterPage } from './analytics-router-page'

const lookup = vi.hoisted(() => vi.fn(() => ({ item: null, isLoading: false })))
vi.mock('@/entities/analytics', () => ({ useAnalyticsItem: lookup }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/pages/analytics/analytics-ai-statistics', () => ({
  AnalyticsAiStatisticsPage: () => <div>AI statistics dashboard</div>,
}))
vi.mock('@/shared/ui/page-skeleton/page-skeleton', () => ({
  PageSkeleton: () => <div>Loading</div>,
}))
afterEach(() => {
  cleanup()
  lookup.mockClear()
})

it('opens the reserved statistics route without fetching a saved analytics item', async () => {
  render(
    <MemoryRouter
      initialEntries={['/modules/Analitika/analytics/ai-statistics']}
    >
      <Routes>
        <Route
          path="/modules/:pageCode/analytics/:code"
          element={<AnalyticsRouterPage />}
        />
      </Routes>
    </MemoryRouter>
  )
  expect(await screen.findByText('AI statistics dashboard')).toBeTruthy()
  expect(lookup).toHaveBeenCalledWith(undefined)
  expect(lookup).not.toHaveBeenCalledWith('ai-statistics')
})
