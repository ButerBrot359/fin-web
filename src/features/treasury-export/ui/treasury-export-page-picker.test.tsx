import '@/app/config/i18n'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { TreasuryExportPage } from './treasury-export-page'
import * as api from '../api/treasury-export-api'
import * as saveLib from '../lib/save-to-directory'
import { showToast } from '@/shared/ui/toast/show-toast'

vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: vi.fn() }))

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/treasury-export?typeCode=T&id=42']}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  )
  return render(<TreasuryExportPage />, { wrapper: Wrapper })
}

const mockPreview = (hasErrors: boolean) =>
  vi.spyOn(api, 'previewTreasuryExport').mockResolvedValue({
    data: {
      data: {
        rows: [
          { n: 1, documentId: 42, typeCode: 'T', presentation: 'Док', amount: 1, errors: [], fileName: 'ЗаявкаГПС.xml' },
        ],
        hasErrors,
      },
      success: true,
    },
  } as never)

beforeEach(() => vi.restoreAllMocks())
afterEach(cleanup)

describe('TreasuryExportPage — сохранение в папку (Chromium)', () => {
  it('picker → fetch → запись blob + success-тост', async () => {
    mockPreview(false)
    vi.spyOn(saveLib, 'supportsDirectoryPicker').mockReturnValue(true)
    const dir = {} as saveLib.FsDirectoryHandle
    vi.spyOn(saveLib, 'pickDirectory').mockResolvedValue(dir)
    const writeSpy = vi.spyOn(saveLib, 'writeBlobToDirectory').mockResolvedValue()
    const blob = new Blob(['x'])
    vi.spyOn(api, 'fetchTreasuryExportBlob').mockResolvedValue({ data: blob } as never)

    renderPage()
    await screen.findByText('Док') // авто-preview отрисован
    fireEvent.click(screen.getByRole('button', { name: 'Выгрузить' }))

    await waitFor(() => {
      expect(writeSpy).toHaveBeenCalledWith(dir, 'ЗаявкаГПС.xml', blob)
    })
    expect(showToast).toHaveBeenCalledWith('success', 'Файл сохранён в выбранную папку')
  })

  it('отмена диалога (null) → нет fetch, нет тоста ошибки', async () => {
    mockPreview(false)
    vi.spyOn(saveLib, 'supportsDirectoryPicker').mockReturnValue(true)
    vi.spyOn(saveLib, 'pickDirectory').mockResolvedValue(null)
    const fetchSpy = vi.spyOn(api, 'fetchTreasuryExportBlob')

    renderPage()
    await screen.findByText('Док')
    fireEvent.click(screen.getByRole('button', { name: 'Выгрузить' }))

    await waitFor(() => {
      expect(saveLib.pickDirectory).toHaveBeenCalled()
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalledWith('error', expect.anything())
  })

  it('нет API → фолбэк на location.assign', async () => {
    mockPreview(false)
    vi.spyOn(saveLib, 'supportsDirectoryPicker').mockReturnValue(false)
    const assignSpy = vi.fn()
    vi.stubGlobal('location', { assign: assignSpy } as unknown as Location)

    renderPage()
    await screen.findByText('Док')
    fireEvent.click(screen.getByRole('button', { name: 'Выгрузить' }))

    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/document-entries/T/42/treasury-export')
      )
    })
  })
})
