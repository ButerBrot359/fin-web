import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useForm } from 'react-hook-form'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useParentFilter } from './use-parent-filter'
import * as osGruppaApi from '../../api/os-gruppa'

vi.mock('../../api/os-gruppa')

const fetchMock = vi.mocked(osGruppaApi.fetchOsGruppaId)

const makeWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

const renderParent = (
  rowFilter: Record<string, string> | undefined,
  formValues: Record<string, unknown>,
) =>
  renderHook(
    () => {
      const { control } = useForm<Record<string, unknown>>({
        defaultValues: formValues,
      })
      return useParentFilter(rowFilter, 'OsnovnyeSredstva.0', control)
    },
    { wrapper: makeWrapper() },
  )

describe('useParentFilter (row-scope отбор пикера по ГруппаОС строки ТЧ)', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it('ОС в ячейке → резолв ГруппаОС → { parent: "<id>" }', async () => {
    fetchMock.mockResolvedValue(55)
    const { result } = renderParent(
      { parent: 'OsnovnoeSredstvo' },
      { OsnovnyeSredstva: [{ OsnovnoeSredstvo: { id: 4711 } }] },
    )
    await waitFor(() => expect(result.current).toEqual({ parent: '55' }))
    expect(fetchMock).toHaveBeenCalledWith(4711)
  })

  it('ячейка ОС пуста → резолв не вызывается, undefined (полный список)', () => {
    const { result } = renderParent(
      { parent: 'OsnovnoeSredstvo' },
      { OsnovnyeSredstva: [{ OsnovnoeSredstvo: null }] },
    )
    expect(result.current).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ГруппаОС не резолвится (null) → undefined (graceful, анти-стейл)', async () => {
    fetchMock.mockResolvedValue(null)
    const { result } = renderParent(
      { parent: 'OsnovnoeSredstvo' },
      { OsnovnyeSredstva: [{ OsnovnoeSredstvo: { id: 999 } }] },
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(999))
    expect(result.current).toBeUndefined()
  })

  it('колонка без rowFilter.parent → резолв не вызывается, undefined', () => {
    const { result } = renderParent(undefined, {
      OsnovnyeSredstva: [{ OsnovnoeSredstvo: { id: 1 } }],
    })
    expect(result.current).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
