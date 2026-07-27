import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useTreasuryExportPreview } from './use-treasury-export-preview'
import * as api from '../../api/treasury-export-api'

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useTreasuryExportPreview', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('возвращает распакованный data из обёртки ApiResponse', async () => {
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
              errors: ['Не указан номер счета банка контрагента!'],
              fileName: 'ЗаявкаГПСAAC00-00007.xml',
            },
          ],
          hasErrors: true,
        },
        success: true,
      },
    } as never)

    const { result } = renderHook(() => useTreasuryExportPreview(), {
      wrapper,
    })
    result.current.mutate([
      { typeCode: 'ZayavkaNaRegistratsiyuGPSdelki', id: 42 },
    ])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.hasErrors).toBe(true)
    expect(result.current.data?.rows[0].fileName).toBe(
      'ЗаявкаГПСAAC00-00007.xml'
    )
  })
})
