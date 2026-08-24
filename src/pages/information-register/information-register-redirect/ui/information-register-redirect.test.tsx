import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { InformationRegisterRedirect } from './information-register-redirect'

vi.mock('@/entities/module', () => ({
  useResolveTypePageCode: () => ({
    isResolving: false,
    pageCode: 'kazna',
  }),
}))
vi.mock('@/shared/ui/page-skeleton/page-skeleton', () => ({
  PageSkeleton: () => null,
}))

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/information-registers/:typeCode"
          element={<InformationRegisterRedirect mode="list" />}
        />
        <Route
          path="/information-registers/:typeCode/new"
          element={<InformationRegisterRedirect mode="new" />}
        />
        <Route
          path="/information-registers/:typeCode/:entryId"
          element={<InformationRegisterRedirect mode="entry" />}
        />
        <Route
          path="/modules/:pageCode/informationregister/:typeCode"
          element={<div>list-page</div>}
        />
        <Route
          path="/modules/:pageCode/informationregister/:typeCode/new"
          element={<div>new-page</div>}
        />
        <Route
          path="/modules/:pageCode/informationregister/:typeCode/:entryId"
          element={<div>entry-page</div>}
        />
      </Routes>
    </MemoryRouter>
  )

// SCRUM-45 §3: плоские ссылки бэка на регистр сведений редиректят в раздел
// без ?domain= — сегмент informationregister сам задаёт домен.
describe('InformationRegisterRedirect', () => {
  it('редиректит /information-registers/:typeCode на список раздела', () => {
    renderAt('/information-registers/KursyValyut')
    expect(screen.getByText('list-page')).toBeTruthy()
  })

  it('редиректит /information-registers/:typeCode/:entryId на карточку', () => {
    renderAt('/information-registers/KursyValyut/1002')
    expect(screen.getByText('entry-page')).toBeTruthy()
  })

  it('статический /new ранжируется выше и не перехватывается entry-роутом', () => {
    renderAt('/information-registers/KursyValyut/new')
    expect(screen.getByText('new-page')).toBeTruthy()
  })
})
