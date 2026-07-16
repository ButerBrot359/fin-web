import type { ReactNode } from 'react'
import type { AxiosResponse } from 'axios'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { apiService } from '@/shared/api/api'
import type { DocumentAttribute } from '@/entities/document-type'

import { useTableColumns } from './use-table-columns'

vi.mock('@/shared/api/api', () => ({
  apiService: { get: vi.fn() },
}))

const getMock = vi.mocked(apiService.get)

const asAxios = <T,>(body: T): AxiosResponse<T> =>
  ({
    data: body,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  }) as unknown as AxiosResponse<T>

const makeWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

const attribute = {
  allowedTypes: [{ typeCode: 'Valyuty_Predstavleniya' }],
} as unknown as DocumentAttribute

const okBody = {
  data: {
    attributes: [
      { code: 'PredstavlenieRu', showInForm: true, sortOrder: 2 },
      { code: 'Hidden', showInForm: false, sortOrder: 1 },
      { code: 'PredstavlenieKz', showInForm: true, sortOrder: 1 },
    ] as DocumentAttribute[],
  },
  success: true,
}

const renderColumns = (domain?: string) =>
  renderHook(() => useTableColumns(attribute, domain), {
    wrapper: makeWrapper(),
  })

describe('useTableColumns — эндпоинт метаданных ТЧ по домену формы', () => {
  beforeEach(() => {
    getMock.mockReset()
    getMock.mockResolvedValue(asAxios(okBody))
  })

  it('DICTIONARY → универсальный types-эндпоинт справочника (фикс 400)', async () => {
    const { result } = renderColumns('DICTIONARY')
    await waitFor(() => expect(result.current.columns.length).toBe(2))
    expect(getMock).toHaveBeenCalledWith({
      url: '/api/universaldomain-types/DICTIONARY/Valyuty_Predstavleniya',
    })
    // showInForm=false отфильтрован, порядок по sortOrder
    expect(
      result.current.columns.map((c: DocumentAttribute) => c.code)
    ).toEqual(['PredstavlenieKz', 'PredstavlenieRu'])
  })

  it('домен не задан → document-types (прежнее поведение документов)', async () => {
    const { result } = renderColumns(undefined)
    await waitFor(() => expect(result.current.columns.length).toBe(2))
    expect(getMock).toHaveBeenCalledWith({
      url: '/api/document-types/Valyuty_Predstavleniya',
    })
  })

  it('DOCUMENT явно → тоже document-types', async () => {
    renderColumns('DOCUMENT')
    await waitFor(() =>
      expect(getMock).toHaveBeenCalledWith({
        url: '/api/document-types/Valyuty_Predstavleniya',
      })
    )
  })
})
