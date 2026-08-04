import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Suspense } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { LegacyFallback } from './legacy-fallback'

// Легаси-страницы ленивые/тяжёлые — мокаем таблицу
vi.mock('../lib/kind-to-legacy', () => ({
  resolveLegacyEntry: (kind: string) =>
    kind === 'DOCUMENT_LIST'
      ? {
          path: '/modules/:pageCode/document/:moduleCode',
          element: <div>ЛЕГАСИ-СПИСОК</div>,
        }
      : null,
}))

describe('LegacyFallback', () => {
  it('монтирует легаси-страницу по kind на совпадающем URL', () => {
    render(
      <MemoryRouter initialEntries={['/modules/kazna/document/RKO']}>
        <Suspense fallback={null}>
          <LegacyFallback kind="DOCUMENT_LIST" />
        </Suspense>
      </MemoryRouter>
    )
    expect(screen.getByText('ЛЕГАСИ-СПИСОК')).toBeTruthy()
  })

  it('неизвестный kind → NotFound', () => {
    render(
      <MemoryRouter initialEntries={['/whatever']}>
        <LegacyFallback kind={null} />
      </MemoryRouter>
    )
    // NotFound рендерит i18n-ключ или перевод.
    // Регекс сужен до `.title`: заголовок и описание NotFound делят
    // подстроку "notFound" в ключах (`sdui.notFound.title` / `.description`),
    // из-за чего исходный /notFound|.../ матчил оба узла (см. отчёт).
    expect(screen.getByText(/notFound\.title|не найдена/i)).toBeTruthy()
  })
})
