import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  dictionaryPermissionKeys,
  useDictionaryPermissions,
  useUpdateDictionaryPermission,
} from './use-dictionary-permissions'
const mocks = vi.hoisted(() => ({ owner: 7, get: vi.fn(), put: vi.fn() }))
vi.mock('@/features/auth/lib/hooks/use-auth-store', () => ({
  useAuthStore: (select: (state: { user: { id: number } }) => unknown) =>
    select({ user: { id: mocks.owner } }),
}))
vi.mock('../../api/analytics-api', () => ({
  analyticsApi: {
    getDictionaryPermissions: mocks.get,
    updateDictionaryPermission: mocks.put,
  },
}))
const row = { typeCode: 'Test', nameRu: 'Тест', nameKz: null, allowed: false }
const page = {
  items: [row],
  page: 0,
  size: 50,
  totalElements: 1,
  allowedCount: 0,
  maxValuesPerDictionary: 50,
  maxValueLength: 120,
}
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}
describe('dictionary permission acknowledgement and account isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.owner = 7
  })
  it('keeps unchecked while pending, prevents double send, applies server acknowledgement', async () => {
    const { client, wrapper } = setup()
    const key = dictionaryPermissionKeys.page(7, '', 0)
    client.setQueryData(key, page)
    let resolve!: (value: typeof row) => void
    mocks.put.mockReturnValue(
      new Promise<typeof row>((done) => {
        resolve = done
      })
    )
    const { result } = renderHook(useUpdateDictionaryPermission, { wrapper })
    act(() => {
      result.current.update('Test', true)
      result.current.update('Test', true)
    })
    await waitFor(() => {
      expect(mocks.put).toHaveBeenCalledTimes(1)
    })
    expect(client.getQueryData(key)).toEqual(page)
    act(() => {
      resolve({ ...row, allowed: true })
    })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryData(key)).toMatchObject({
      items: [{ allowed: true }],
      allowedCount: 1,
    })
  })
  it('retains saved value on rejected PUT and permits explicit retry', async () => {
    const { client, wrapper } = setup()
    const key = dictionaryPermissionKeys.page(7, '', 0)
    client.setQueryData(key, page)
    mocks.put
      .mockRejectedValueOnce(new Error('denied'))
      .mockResolvedValueOnce({ ...row, allowed: true })
    const { result } = renderHook(useUpdateDictionaryPermission, { wrapper })
    act(() => {
      result.current.update('Test', true)
    })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(client.getQueryData(key)).toEqual(page)
    act(() => {
      result.current.update('Test', true)
    })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mocks.put).toHaveBeenCalledTimes(2)
  })
  it('does not expose a previous account cached page and sends search/page', async () => {
    const { client, wrapper } = setup()
    client.setQueryData(dictionaryPermissionKeys.page(7, 'test', 2), page)
    mocks.owner = 8
    mocks.get.mockResolvedValue({ ...page, items: [] })
    const { result } = renderHook(() => useDictionaryPermissions('test', 2), {
      wrapper,
    })
    expect(result.current.data).toBeUndefined()
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mocks.get).toHaveBeenCalledWith('test', 2, expect.any(AbortSignal))
    expect(result.current.data?.items).toEqual([])
  })
})
