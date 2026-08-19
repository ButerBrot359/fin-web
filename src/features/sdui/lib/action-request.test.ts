import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiService } from '@/shared/api/api'

import { createActionRequestExecutor } from './action-request'

vi.mock('@/shared/api/api', () => ({
  apiService: { get: vi.fn(), post: vi.fn() },
}))
const mockGet = vi.mocked(apiService.get)
const mockPost = vi.mocked(apiService.post)

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockResolvedValue({ data: { effects: [] } } as never)
  mockPost.mockResolvedValue({ data: { effects: [] } } as never)
})

describe('executeActionRequest', () => {
  it('POST c selectedRowId — дописывает РОВНО один параметр и играет effects', async () => {
    const play = vi.fn()
    mockPost.mockResolvedValue({
      data: { effects: [{ type: 'notify', message: 'ok' }] },
    } as never)
    await createActionRequestExecutor(play)(
      {
        method: 'POST',
        url: '/api/view/related-documents/post?rootId=1&anchorId=2',
        body: null,
      },
      '77'
    )
    expect(mockPost).toHaveBeenCalledWith({
      url: '/api/view/related-documents/post?rootId=1&anchorId=2&selectedRowId=77',
      data: undefined,
    })
    expect(play).toHaveBeenCalledWith([{ type: 'notify', message: 'ok' }])
  })

  it('GET без selectedRowId — url не трогается, уходит через get', async () => {
    const play = vi.fn()
    await createActionRequestExecutor(play)(
      { method: 'GET', url: '/api/view/related-documents/5?anchorId=2' },
      undefined
    )
    expect(mockGet).toHaveBeenCalledWith({
      url: '/api/view/related-documents/5?anchorId=2',
    })
    expect(mockPost).not.toHaveBeenCalled()
    expect(play).toHaveBeenCalledWith([])
  })

  it('body уходит как data при POST', async () => {
    const play = vi.fn()
    await createActionRequestExecutor(play)(
      { method: 'POST', url: '/api/x?y=1', body: { a: 1 } },
      undefined
    )
    expect(mockPost).toHaveBeenCalledWith({ url: '/api/x?y=1', data: { a: 1 } })
  })

  it('effects отсутствуют — играет пустой массив', async () => {
    const play = vi.fn()
    mockGet.mockResolvedValue({ data: {} } as never)
    await createActionRequestExecutor(play)(
      { method: 'GET', url: '/api/x?y=1' },
      undefined
    )
    expect(play).toHaveBeenCalledWith([])
  })

  it('B-7: неизвестный method — warn, запрос не уходит, effects не играются', async () => {
    const play = vi.fn()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await createActionRequestExecutor(play)(
      { method: 'DELETE' as never, url: '/api/x?y=1' },
      undefined
    )
    expect(warn).toHaveBeenCalledTimes(1)
    expect(mockGet).not.toHaveBeenCalled()
    expect(mockPost).not.toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('§6.3: revision/patches/state/formSessionId в ответе игнорируются — играются только effects', async () => {
    const play = vi.fn()
    mockPost.mockResolvedValue({
      data: {
        effects: [{ type: 'notify', message: 'ok' }],
        revision: 99,
        patches: [{ op: 'setProp', nodeId: 'x' }],
        state: { a: 1 },
        formSessionId: 'zzz',
      },
    } as never)
    await createActionRequestExecutor(play)(
      {
        method: 'POST',
        url: '/api/view/related-documents/post?rootId=1&anchorId=2',
      },
      '7'
    )
    expect(play).toHaveBeenCalledTimes(1)
    expect(play).toHaveBeenCalledWith([{ type: 'notify', message: 'ok' }])
  })
})
