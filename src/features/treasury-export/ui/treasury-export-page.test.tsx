import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import i18n from '@/app/config/i18n'

import { TreasuryExportPage } from './treasury-export-page'
import * as api from '../api/treasury-export-api'

const renderPage = (search: string) => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/treasury-export${search}`]}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  )
  return render(<TreasuryExportPage />, { wrapper: Wrapper })
}

const mockPreview = (hasErrors: boolean, errors: string[] = []) =>
  vi.spyOn(api, 'previewTreasuryExport').mockResolvedValue({
    data: {
      data: {
        rows: [
          {
            n: 1,
            documentId: 42,
            typeCode: 'ZayavkaNaRegistratsiyuGPSdelki',
            presentation: 'Заявка AAC00-00007',
            amount: 5000,
            errors,
            fileName: 'ЗаявкаГПСAAC00-00007.xml',
          },
        ],
        hasErrors,
      },
      success: true,
    },
  } as never)

describe('TreasuryExportPage', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    vi.stubGlobal('location', { assign: vi.fn() } as unknown as Location)
    await i18n.changeLanguage('ru')
  })

  afterEach(cleanup)

  it('авто-preview при маунте заполняет таблицу', async () => {
    mockPreview(false)
    renderPage('?typeCode=ZayavkaNaRegistratsiyuGPSdelki&id=42')
    await waitFor(() => {
      expect(screen.getByText('Заявка AAC00-00007')).toBeTruthy()
    })
    expect(api.previewTreasuryExport).toHaveBeenCalledWith([
      { typeCode: 'ZayavkaNaRegistratsiyuGPSdelki', id: 42 },
    ])
  })

  it('чистый результат по «Выгрузить» → навигация на GET-URL', async () => {
    mockPreview(false)
    renderPage('?typeCode=ZayavkaNaRegistratsiyuGPSdelki&id=42')
    await screen.findByText('Заявка AAC00-00007')
    fireEvent.click(screen.getByRole('button', { name: 'Выгрузить' }))
    await waitFor(() => {
      expect(window.location.assign).toHaveBeenCalledWith(
        expect.stringContaining(
          '/api/document-entries/ZayavkaNaRegistratsiyuGPSdelki/42/treasury-export'
        )
      )
    })
  })

  it('hasErrors по «Выгрузить» → нет навигации, показан блок ошибок', async () => {
    mockPreview(true, ['Не указан номер счета банка контрагента!'])
    renderPage('?typeCode=ZayavkaNaRegistratsiyuGPSdelki&id=42')
    await screen.findByText('Заявка AAC00-00007')
    fireEvent.click(screen.getByRole('button', { name: 'Выгрузить' }))
    await waitFor(() => {
      expect(
        screen.getAllByText(/Не указан номер счета банка контрагента!/).length
      ).toBeGreaterThan(0)
    })
    expect(window.location.assign).not.toHaveBeenCalled()
  })
})
