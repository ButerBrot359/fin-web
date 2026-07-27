import { describe, it, expect, vi, beforeEach } from 'vitest'

import { apiService } from '@/shared/api/api'
import { fetchReferenceOptions } from './reference-options'

vi.mock('@/shared/api/api', () => ({
  apiService: { get: vi.fn() },
}))

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
