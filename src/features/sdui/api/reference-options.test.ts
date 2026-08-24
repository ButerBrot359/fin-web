import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/shared/api/api', () => ({
  apiService: { get: vi.fn(), post: vi.fn() },
}))

import { apiService } from '@/shared/api/api'
import { fetchReferenceOptions, fetchListPage } from './reference-options'

describe('fetchReferenceOptions (SCRUM-287 A5/A6)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('мапит content → {id, code, label=presentation}', async () => {
    vi.mocked(apiService.get).mockResolvedValue({
      data: { content: [{ id: 7, presentation: 'Организация №1' }] },
    } as never)
    const opts = await fetchReferenceOptions({ url: '/x' })
    expect(opts).toEqual([{ id: 7, code: '7', label: 'Организация №1' }])
  })

  it('строка без presentation → label = String(id) (фолбэк по name убран)', async () => {
    vi.mocked(apiService.get).mockResolvedValue({
      data: { content: [{ id: 9, name: 'НЕ-презентация' }] },
    } as never)
    const opts = await fetchReferenceOptions({ url: '/x' })
    expect(opts[0].label).toBe('9')
  })
})

describe('fetchListPage — транспорт', () => {
  beforeEach(() => {
    vi.mocked(apiService.get).mockReset()
    vi.mocked(apiService.post).mockReset()
  })

  it('method POST → apiService.post с data:body и page/size в params', async () => {
    vi.mocked(apiService.post).mockResolvedValue({
      data: { data: { content: [], last: true, number: 0 } },
    } as never)

    await fetchListPage({
      url: '/x/search',
      method: 'POST',
      params: { sortAttr: 'Data' },
      body: { filters: [], logic: 'AND' },
      page: 0,
      size: 25,
    })

    expect(apiService.post).toHaveBeenCalledWith({
      url: '/x/search',
      params: { sortAttr: 'Data', page: 0, size: 25 },
      data: { filters: [], logic: 'AND' },
      signal: undefined,
    })
    expect(apiService.get).not.toHaveBeenCalled()
  })

  it('POST + search → q в теле, search НЕ в params (SCRUM-45 §4-бис.1)', async () => {
    vi.mocked(apiService.post).mockResolvedValue({
      data: { data: { content: [], last: true, number: 0 } },
    } as never)

    await fetchListPage({
      url: '/x/search',
      method: 'POST',
      body: { filters: [], logic: 'AND' },
      page: 0,
      size: 25,
      search: '  казна  ',
    })

    expect(apiService.post).toHaveBeenCalledWith({
      url: '/x/search',
      params: { page: 0, size: 25 },
      data: { filters: [], logic: 'AND', q: 'казна' },
      signal: undefined,
    })
  })

  it('GET + search → search остаётся в query (регресс PAGED)', async () => {
    vi.mocked(apiService.get).mockResolvedValue({
      data: { data: { content: [], last: true, number: 0 } },
    } as never)

    await fetchListPage({ url: '/x/paged', page: 0, size: 25, search: 'акт' })

    expect(apiService.get).toHaveBeenCalledWith({
      url: '/x/paged',
      params: { page: 0, size: 25, search: 'акт' },
      signal: undefined,
    })
  })

  it('без method → apiService.get, body не уходит (регресс PAGED)', async () => {
    vi.mocked(apiService.get).mockResolvedValue({
      data: { data: { content: [], totalElements: 0, last: true, number: 0 } },
    } as never)

    await fetchListPage({
      url: '/x/paged',
      params: { sortAttr: 'Data' },
      page: 0,
      size: 25,
    })

    expect(apiService.get).toHaveBeenCalledWith({
      url: '/x/paged',
      params: { sortAttr: 'Data', page: 0, size: 25 },
      signal: undefined,
    })
    expect(apiService.post).not.toHaveBeenCalled()
  })
})
