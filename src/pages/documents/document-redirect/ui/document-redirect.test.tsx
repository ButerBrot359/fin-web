import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { DocumentRedirect } from './document-redirect'

vi.mock('@/entities/module', () => ({
  useResolveTypePageCode: () => ({
    isResolving: false,
    pageCode: 'ZarplatiIKadri',
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
          path="/documents/:typeCode"
          element={<DocumentRedirect mode="list" />}
        />
        <Route
          path="/documents/:typeCode/new"
          element={<DocumentRedirect mode="new" />}
        />
        <Route
          path="/documents/:typeCode/:entryId"
          element={<DocumentRedirect mode="entry" />}
        />
        <Route
          path="/modules/:pageCode/document/:typeCode"
          element={<div>list-page</div>}
        />
        <Route
          path="/modules/:pageCode/document/:typeCode/new"
          element={<div>new-page</div>}
        />
        <Route
          path="/modules/:pageCode/document/:typeCode/:entryId"
          element={<div>entry-page</div>}
        />
      </Routes>
    </MemoryRouter>
  )

describe('DocumentRedirect mode=entry', () => {
  it('редиректит /documents/:typeCode/:entryId в раздел с entryId', () => {
    renderAt('/documents/SchetKOplate/1002')
    expect(screen.getByText('entry-page')).toBeTruthy()
  })

  it('статический /new ранжируется выше и не перехватывается entry-роутом', () => {
    renderAt('/documents/SchetKOplate/new')
    expect(screen.getByText('new-page')).toBeTruthy()
  })
})
