import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import type { AnalyticsItem } from '@/entities/analytics'

import { AnalyticsItemCopyBar } from './analytics-item-copy-bar'

const copyItem = vi.fn()
vi.mock('@/entities/analytics/api/analytics-api', () => ({
  analyticsApi: {
    copyItem: (...args: unknown[]) => copyItem(...args) as unknown,
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const showToast = vi.fn()
vi.mock('@/shared/ui/toast/show-toast', () => ({
  showToast: (...args: unknown[]) => showToast(...args) as unknown,
}))

const item = (shared: boolean): AnalyticsItem => ({
  code: 'Raskhody',
  kind: 'REPORT',
  titleRu: 'Расходы',
  isFavorite: false,
  shared,
  spec: { kind: 'REPORT' } as AnalyticsItem['spec'],
  specVersion: 1,
})

const renderBar = (value: AnalyticsItem) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/modules/Analitika/analytics/Raskhody']}>
        <Routes>
          <Route
            path="/modules/:pageCode/analytics/:code"
            element={<AnalyticsItemCopyBar item={value} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )

describe('AnalyticsItemCopyBar', () => {
  beforeEach(() => {
    copyItem.mockReset()
    showToast.mockReset()
  })
  afterEach(cleanup)

  it('общий объект помечен и предлагает сохранить копию', () => {
    renderBar(item(true))
    expect(screen.getByText('analytics.item.shared')).toBeTruthy()
    expect(screen.getByText('analytics.item.copy')).toBeTruthy()
  })

  it('у личного объекта пометки «Общий» нет', () => {
    renderBar(item(false))
    expect(screen.queryByText('analytics.item.shared')).toBeNull()
  })

  it('копия запрашивается по коду и сообщает об успехе', async () => {
    copyItem.mockResolvedValue({ ...item(false), code: 'RaskhodyKopiya' })
    renderBar(item(true))
    fireEvent.click(screen.getByText('analytics.item.copy'))
    await waitFor(() => {
      expect(copyItem).toHaveBeenCalledWith('Raskhody')
    })
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('success', 'analytics.item.copied')
    })
  })

  it('отказ сервера показывается текстом из ответа', async () => {
    copyItem.mockRejectedValue({ message: 'Нет доступа' })
    renderBar(item(true))
    fireEvent.click(screen.getByText('analytics.item.copy'))
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('error', 'Нет доступа')
    })
  })
})
