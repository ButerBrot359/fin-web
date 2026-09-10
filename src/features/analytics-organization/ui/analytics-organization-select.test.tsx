import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import {
  analyticsKeys,
  useAnalyticsOrganizationStore,
} from '@/entities/analytics'

import { AnalyticsOrganizationSelect } from './analytics-organization-select'

const getOrganizations = vi.fn()
vi.mock('@/entities/analytics/api/analytics-api', () => ({
  analyticsApi: {
    getOrganizations: (...args: unknown[]) =>
      getOrganizations(...args) as unknown,
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

/**
 * Ожидание асинхронных шагов с запасом. Список организаций приходит запросом, а
 * выпадающий список MUI рисуется порталом: в полном прогоне под нагрузкой
 * секунды по умолчанию не хватает, и тест падал бы не находя дефекта.
 */
const SLOW = { timeout: 5000 }

const renderSelect = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AnalyticsOrganizationSelect />
    </QueryClientProvider>
  )

/**
 * Выбор организации на страницах аналитики.
 *
 * Проверяется то, что видит бухгалтер: по умолчанию «все организации», выбор
 * запоминается на весь раздел, а поле не подписывает «все» то, что на деле
 * отобрано по организации, которой больше нет.
 */
describe('AnalyticsOrganizationSelect', () => {
  beforeEach(() => {
    useAnalyticsOrganizationStore.setState({ organizationId: null })
    getOrganizations.mockResolvedValue([
      { id: 30267, name: 'Батыс Қазақстан облысы' },
      { id: 71929, name: 'ГУ «Отдел ЖКХ»' },
    ])
  })

  afterEach(cleanup)

  it('по умолчанию выбраны все организации', () => {
    renderSelect()

    expect(screen.getByDisplayValue('analytics.organization.all')).toBeTruthy()
  })

  it('выбранная организация становится общим выбором раздела', async () => {
    renderSelect()

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })
    fireEvent.click(
      await screen.findByText('Батыс Қазақстан облысы', undefined, SLOW)
    )

    expect(useAnalyticsOrganizationStore.getState().organizationId).toBe(30267)
  })

  it('«Все организации» снимает отбор', async () => {
    useAnalyticsOrganizationStore.setState({ organizationId: 30267 })
    renderSelect()

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })
    fireEvent.click(
      await screen.findByText('analytics.organization.all', undefined, SLOW)
    )

    expect(useAnalyticsOrganizationStore.getState().organizationId).toBeNull()
  })

  it('исчезнувшая организация подписана как ненайденная, а не как «все»', async () => {
    useAnalyticsOrganizationStore.setState({ organizationId: 555 })
    renderSelect()

    // Запросы по-прежнему идут по ней: поле обязано показывать применённое.
    await waitFor(() => {
      expect(
        screen.getByDisplayValue(/analytics\.organization\.notFound/)
      ).toBeTruthy()
    }, SLOW)
  })
})

describe('analyticsKeys.dataset', () => {
  it('смена организации даёт другой ключ — данные перезапрашиваются', () => {
    expect(analyticsKeys.dataset('hash', '{}', null)).not.toEqual(
      analyticsKeys.dataset('hash', '{}', 30267)
    )
    expect(analyticsKeys.dataset('hash', '{}', null)).toContain('all')
  })
})
