import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiService } from '@/shared/api/api'

import { useSduiEffects } from './use-sdui-effects'

vi.mock('@/shared/api/api', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    getFileBlob: vi.fn(),
    postFileBlob: vi.fn(),
  },
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(''), vi.fn()],
}))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))
vi.mock('./sdui-session-context', () => ({
  useSduiSession: () => ({
    getSession: () => ({ formSessionId: null, revision: null }),
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiService.post).mockResolvedValue({
    data: { effects: [] },
  } as never)
})

describe('useSduiEffects', () => {
  it('возвращает play/playAll/executeActionRequest', () => {
    const { result } = renderHook(() => useSduiEffects())
    expect(typeof result.current.play).toBe('function')
    expect(typeof result.current.playAll).toBe('function')
    expect(typeof result.current.executeActionRequest).toBe('function')
  })

  it('executeActionRequest шлёт POST по request', async () => {
    const { result } = renderHook(() => useSduiEffects())
    await result.current.executeActionRequest(
      { method: 'POST', url: '/api/x?a=1' },
      '5'
    )
    expect(apiService.post).toHaveBeenCalledWith({
      url: '/api/x?a=1&selectedRowId=5',
      data: undefined,
    })
  })
})
