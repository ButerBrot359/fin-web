import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/app/config/i18n'

import { SwiftExportPage } from './swift-export-page'
import * as api from '../api/swift-export-api'

vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: vi.fn() }))

const renderPage = (search = '?typeCode=SchetKOplate&id=42') =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/swift-export${search}`]}>
        <Routes>
          <Route path="/swift-export" element={<SwiftExportPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )

const previewResponse = (hasErrors: boolean, errors: string[] = []) => ({
  data: {
    rows: [
      {
        number: 1,
        documentId: 42,
        documentNumber: 'AAH00-00167',
        amount: 2790197,
        fileName: 'SWIFT_AAH00-00167.txt',
        errors,
      },
    ],
    hasErrors,
  },
})

let clickMock: ReturnType<typeof vi.fn>

describe('SwiftExportPage', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    clickMock = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickMock)
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:swift'),
      revokeObjectURL: vi.fn(),
    })
    await i18n.changeLanguage('ru')
  })

  afterEach(cleanup)

  it('проверяет документ при открытии и показывает строку таблицы', async () => {
    const preview = vi
      .spyOn(api, 'previewSwiftExport')
      .mockResolvedValue(previewResponse(false) as never)

    renderPage()

    await waitFor(() => {
      expect(preview).toHaveBeenCalledWith({
        documentIds: [42],
        format: 'FORMAT_01_2024',
        encoding: 'KZ_1048',
      })
    })
    expect(await screen.findByText('AAH00-00167')).toBeTruthy()
    expect(screen.getByText('SWIFT_AAH00-00167.txt')).toBeTruthy()
  })

  it('перепроверяет документ при смене формата', async () => {
    const preview = vi
      .spyOn(api, 'previewSwiftExport')
      .mockResolvedValue(previewResponse(false) as never)

    renderPage()
    await waitFor(() => {
      expect(preview).toHaveBeenCalledTimes(1)
    })

    fireEvent.mouseDown(screen.getAllByRole('combobox')[0])
    fireEvent.click(await screen.findByText('Формат с 10.2023 года'))

    await waitFor(() => {
      expect(preview).toHaveBeenLastCalledWith({
        documentIds: [42],
        format: 'FORMAT_10_2023',
        encoding: 'KZ_1048',
      })
    })
  })

  it('при ошибках проверки не уводит на скачивание', async () => {
    vi.spyOn(api, 'previewSwiftExport').mockResolvedValue(
      previewResponse(true, [
        'Нет действующего карт-счёта: Сидорова Мария',
      ]) as never
    )
    const blobSpy = vi.spyOn(api, 'fetchSwiftExportBlob')

    renderPage()
    expect(
      (
        await screen.findAllByText(
          'Нет действующего карт-счёта: Сидорова Мария'
        )
      ).length
    ).toBeGreaterThan(0)

    fireEvent.click(screen.getByText('Выгрузить'))

    await waitFor(() => {
      expect(blobSpy).not.toHaveBeenCalled()
    })
  })

  it('без ошибок скачивает файл авторизованным запросом с выбранными параметрами', async () => {
    vi.spyOn(api, 'previewSwiftExport').mockResolvedValue(
      previewResponse(false) as never
    )
    const blobSpy = vi.spyOn(api, 'fetchSwiftExportBlob').mockResolvedValue({
      data: new Blob(['{1:F01}']),
      headers: {
        'content-disposition': 'attachment; filename="SWIFT_AAH00-00167.txt"',
      },
    } as never)

    renderPage()
    await screen.findByText('AAH00-00167')

    fireEvent.click(screen.getByText('Выгрузить'))

    await waitFor(() => {
      expect(blobSpy).toHaveBeenCalledWith(
        'SchetKOplate',
        42,
        'FORMAT_01_2024',
        'KZ_1048'
      )
    })
    await waitFor(() => {
      expect(clickMock).toHaveBeenCalled()
    })
  })
})
