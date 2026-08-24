import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api', () => ({ searchEavEntries: vi.fn() }))

import { searchEavEntries } from './api'
import type { EavDomainConfig } from './domain-config'
import { useEavEntries } from './use-eav-entries'

const config = (over: Partial<EavDomainConfig>): EavDomainConfig =>
  ({
    queryKeyPrefix: 'test',
    supportsQSearch: true,
    ...over,
  }) as EavDomainConfig

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
)

// SCRUM-360 §2: q переехал из query-параметров в тело FilterRequest — защита
// buildSafeExtra больше его не видит, поэтому срезаем из тела по тому же
// config.supportsQSearch (иначе регистры получат HTTP 400).
describe('useEavEntries — q в теле FilterRequest', () => {
  beforeEach(() => {
    vi.mocked(searchEavEntries).mockReset()
    vi.mocked(searchEavEntries).mockResolvedValue({
      data: { data: { content: [], last: true, number: 0 } },
    } as never)
  })

  it('supportsQSearch=true → q уходит в тело', async () => {
    renderHook(
      () =>
        useEavEntries(config({ supportsQSearch: true }), 'Banki', {
          filter: { filters: [], logic: 'AND', q: 'kk' },
        }),
      { wrapper }
    )
    await waitFor(() => {
      expect(searchEavEntries).toHaveBeenCalled()
    })
    expect(vi.mocked(searchEavEntries).mock.calls[0][2]).toEqual({
      filters: [],
      logic: 'AND',
      q: 'kk',
    })
  })

  it('supportsQSearch=false (регистры) → q вырезан из тела', async () => {
    renderHook(
      () =>
        useEavEntries(config({ supportsQSearch: false }), 'SomeRegister', {
          filter: { filters: [], logic: 'AND', q: 'kk' },
        }),
      { wrapper }
    )
    await waitFor(() => {
      expect(searchEavEntries).toHaveBeenCalled()
    })
    expect(vi.mocked(searchEavEntries).mock.calls[0][2]).toEqual({
      filters: [],
      logic: 'AND',
    })
  })
})
