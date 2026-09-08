import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import '@/app/config/i18n'

import { ModuleElementType, type ModuleElement } from '@/entities/module'

import { ModuleNavItem } from './module-nav-item'

// Иконки и кнопка «избранное» к маршруту отношения не имеют, а в jsdom SVG-заглушки Vite
// падают на разборе data-URL — тем же приёмом они отключены в confirm-dialog.test.tsx.
vi.mock('@/shared/assets/icons/arrow-right-small-blue.svg', () => ({
  default: () => null,
}))
vi.mock('@/features/favorite-button', () => ({
  FavoriteButton: () => null,
}))

const element = (overrides: Partial<ModuleElement>): ModuleElement => ({
  code: 'OborotnoSaldovayaVedomost',
  type: ModuleElementType.Report,
  domainKind: null,
  nameRu: 'Оборотно-сальдовая ведомость',
  nameKz: 'Айналым-сальдо тізімдемесі',
  ...overrides,
})

const hrefOf = (item: ModuleElement) => {
  render(
    <MemoryRouter>
      <ModuleNavItem item={item} pageCode="Administrirovanie" />
    </MemoryRouter>
  )
  return screen.getByRole('link').getAttribute('href')
}

/**
 * Ссылка пункта меню.
 *
 * Обычный пункт ведёт на вычисляемый путь `/modules/{pageCode}/{type}/{code}`, но собственным
 * экранам вне SDUI (журнал регистрации, снятие блокировок) вычислять нечего — у них нет объекта
 * метаданных. Для них бэкенд присылает готовый `route`, и он должен побеждать.
 */
describe('ModuleNavItem', () => {
  afterEach(cleanup)

  it('обычный пункт ведёт на путь, собранный из типа и кода', () => {
    expect(hrefOf(element({ domainKind: 'ACCOUNTING_REGISTER' }))).toBe(
      '/modules/Administrirovanie/report/OborotnoSaldovayaVedomost?domain=ACCOUNTING_REGISTER'
    )
  })

  it('готовый route имеет приоритет над вычисляемым путём', () => {
    expect(
      hrefOf(
        element({
          code: 'ZhurnalRegistratsii',
          route: '/admin/audit',
          nameRu: 'Журнал регистрации',
        })
      )
    ).toBe('/admin/audit')
  })
})
