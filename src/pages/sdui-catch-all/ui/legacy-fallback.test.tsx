import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LegacyFallback } from './legacy-fallback'

// Легаси-страницы тяжёлые — мокаем баррели, важен только маршрутинг.
vi.mock('@/pages/documents/documents-entry', () => ({
  LegacyDocumentEntryPage: () => <div>legacy-document-entry</div>,
}))
vi.mock('@/pages/dictionaries/dictionary-entry', () => ({
  LegacyDictionaryEntryPage: () => <div>legacy-dictionary-entry</div>,
}))
// Плоские роуты /documents/:typeCode… и /dictionaries/:typeCode… резолвятся
// бэком, но легаси-страницам нужен pageCode из module-URL — на 422 с плоского
// URL монтируем редиректы, которые сначала находят pageCode (SCRUM-360 этап B,
// рулинг контроллера 2026-08-31).
vi.mock('@/pages/documents/document-redirect', () => ({
  DocumentRedirect: ({ mode }: { mode: string }) => (
    <div>document-redirect-{mode}</div>
  ),
}))
vi.mock('@/pages/dictionaries/dictionary-redirect', () => ({
  DictionaryRedirect: ({ mode }: { mode: string }) => (
    <div>dictionary-redirect-{mode}</div>
  ),
}))

const renderAt = (kind: string, url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <LegacyFallback kind={kind} />
    </MemoryRouter>
  )

describe('LegacyFallback: карточные kind (SCRUM-360 этап B)', () => {
  afterEach(cleanup)

  it('DOCUMENT матчит карточный module-путь', async () => {
    renderAt('DOCUMENT', '/modules/Bank/document/Plat/42')
    expect(await screen.findByText('legacy-document-entry')).toBeTruthy()
  })
  it('DOCUMENT_NEW матчит /new', async () => {
    renderAt('DOCUMENT_NEW', '/modules/Bank/document/Plat/new')
    expect(await screen.findByText('legacy-document-entry')).toBeTruthy()
  })
  it('DICTIONARY матчит карточный путь справочника', async () => {
    renderAt('DICTIONARY', '/modules/Zik/dictionary/Banki/7')
    expect(await screen.findByText('legacy-dictionary-entry')).toBeTruthy()
  })
  it('DICTIONARY_NEW матчит /new', async () => {
    renderAt('DICTIONARY_NEW', '/modules/Zik/dictionary/Banki/new')
    expect(await screen.findByText('legacy-dictionary-entry')).toBeTruthy()
  })
  it('неизвестный kind — NotFound', () => {
    renderAt('NO_SUCH_KIND', '/whatever')
    expect(screen.queryByText(/legacy-|redirect-/)).toBeNull()
  })

  // Плоские пути (бэк резолвит /documents/... и /dictionaries/... напрямую).
  it('DOCUMENT матчит плоский путь /documents/:typeCode/:entryId → редирект', async () => {
    renderAt('DOCUMENT', '/documents/Plat/42')
    expect(await screen.findByText('document-redirect-entry')).toBeTruthy()
  })
  it('DOCUMENT_LIST матчит плоский путь /documents/:typeCode → редирект', async () => {
    renderAt('DOCUMENT_LIST', '/documents/Plat')
    expect(await screen.findByText('document-redirect-list')).toBeTruthy()
  })
  it('DICTIONARY матчит плоский путь /dictionaries/:typeCode/:entryId → редирект', async () => {
    renderAt('DICTIONARY', '/dictionaries/Banki/7')
    expect(await screen.findByText('dictionary-redirect-entry')).toBeTruthy()
  })
})
