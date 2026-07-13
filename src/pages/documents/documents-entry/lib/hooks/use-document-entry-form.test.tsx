import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getDocumentEntry,
  getNewDocumentEntry,
} from '@/entities/document-entry'
import { useDocumentEntryForm } from './use-document-entry-form'

vi.mock('@/entities/document-entry', () => ({
  getDocumentEntry: vi.fn(),
  getNewDocumentEntry: vi.fn(),
}))

const router = vi.hoisted(() => ({ search: '' }))

vi.mock('react-router-dom', () => ({
  useParams: () => ({ moduleCode: 'SchetKOplate', entryId: 'new' }),
  useLocation: () => ({ pathname: '/documents/SchetKOplate/new' }),
  useSearchParams: () => [new URLSearchParams(router.search)],
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
)

describe('useDocumentEntryForm: basisId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    router.search = ''
    vi.mocked(getNewDocumentEntry).mockResolvedValue({
      data: { data: { attributes: { Postavshchik: 'X' } } },
    } as never)
  })

  it('с basisId=5 зовёт /new с { basisId: "5" }, copyFrom-путь не зовётся', async () => {
    router.search = 'basisId=5'

    renderHook(() => useDocumentEntryForm(), { wrapper })

    await waitFor(() =>
      { expect(getNewDocumentEntry).toHaveBeenCalledWith('SchetKOplate', {
        basisId: '5',
      }); },
    )
    expect(getDocumentEntry).not.toHaveBeenCalled()
  })

  it('без параметров /new не зовётся', async () => {
    const { result } = renderHook(() => useDocumentEntryForm(), { wrapper })

    await waitFor(() => { expect(result.current.isLoading).toBe(false); })
    expect(getNewDocumentEntry).not.toHaveBeenCalled()
  })
})
