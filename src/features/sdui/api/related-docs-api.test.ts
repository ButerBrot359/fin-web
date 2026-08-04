import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiService } from '@/shared/api/api'

import { fetchRelatedDocsView, postRelatedDocsAction } from './related-docs-api'

vi.mock('@/shared/api/api', () => ({
  apiService: { get: vi.fn(), post: vi.fn() },
}))

const mockGet = vi.mocked(apiService.get)
const mockPost = vi.mocked(apiService.post)

describe('related-docs-api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockResolvedValue({
      data: { formSessionId: '', revision: 0 },
    } as never)
    mockPost.mockResolvedValue({
      data: { formSessionId: '', revision: 0 },
    } as never)
  })

  it('GET без anchorId — params не передаются', async () => {
    await fetchRelatedDocsView('42')
    expect(mockGet).toHaveBeenCalledWith({
      url: '/api/view/related-documents/42',
      params: undefined,
    })
  })

  it('GET с anchorId — anchorId в query', async () => {
    await fetchRelatedDocsView('42', '7')
    expect(mockGet).toHaveBeenCalledWith({
      url: '/api/view/related-documents/42',
      params: { anchorId: '7' },
    })
  })

  it('POST действия — путь по action, rootId и anchorId в query', async () => {
    await postRelatedDocsAction('toggle-deletion-mark', '42', '1', '7')
    expect(mockPost).toHaveBeenCalledWith({
      url: '/api/view/related-documents/42/toggle-deletion-mark',
      params: { rootId: '1', anchorId: '7' },
    })
  })
})
