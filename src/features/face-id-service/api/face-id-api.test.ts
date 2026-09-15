import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  create: vi.fn(),
  authenticatedGet: vi.fn(),
  authenticatedPost: vi.fn(),
  put: vi.fn(),
}))
vi.mock('axios', () => ({
  default: {
    create: mocks.create.mockReturnValue({ get: mocks.get, post: mocks.post }),
    isAxiosError: () => false,
  },
}))
vi.mock('@/shared/api/api', () => ({
  apiService: {
    get: mocks.authenticatedGet,
    post: mocks.authenticatedPost,
    put: mocks.put,
  },
}))

import {
  completeFaceId,
  enrollFaceIdProfile,
  getFaceIdProfile,
  replaceFaceIdProfile,
  startFaceId,
} from './face-id-api'

describe('Face ID wire contract', () => {
  beforeEach(() => {
    mocks.post.mockReset().mockResolvedValue({ data: {} })
    mocks.authenticatedPost
      .mockReset()
      .mockResolvedValue({ data: { data: {} } })
    mocks.authenticatedGet.mockReset().mockResolvedValue({ data: { data: {} } })
    mocks.put.mockReset().mockResolvedValue({ data: { data: {} } })
  })

  it('uses only browser proof on anonymous identify requests', async () => {
    await startFaceId('browser-proof')
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(
      '/api/auth/face-id/start',
      { mode: 'identify', browserToken: 'browser-proof' }
    )
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      })
    )
  })

  it('exchanges code without profile identity from browser', async () => {
    await completeFaceId({
      state: 'state',
      code: 'code',
      browserToken: 'proof',
    })
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(
      '/api/auth/face-id/complete',
      { state: 'state', code: 'code', browserToken: 'proof' }
    )
  })

  it('enrolls selected dictionary ID and sends no subject/name/tenant/API key', async () => {
    await enrollFaceIdProfile({ kind: 'user', userEntryId: 123 }, 'jpeg-base64')
    expect(mocks.authenticatedPost).toHaveBeenCalledExactlyOnceWith({
      url: '/api/users/123/face-id',
      data: { image: 'jpeg-base64', consent: true },
      timeout: 45_000,
    })
  })

  it('self operations use only /me even when the local cache identity differs', async () => {
    const target = { kind: 'self' as const, accountId: 98765 }
    await getFaceIdProfile(target)
    await enrollFaceIdProfile(target, 'jpeg-base64')
    await replaceFaceIdProfile(target, 'new-jpeg', 'current-profile')
    expect(mocks.authenticatedGet).toHaveBeenCalledExactlyOnceWith({
      url: '/api/me/face-id',
    })
    expect(mocks.authenticatedPost).toHaveBeenCalledExactlyOnceWith({
      url: '/api/me/face-id',
      data: { image: 'jpeg-base64', consent: true },
      timeout: 45_000,
    })
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith({
      url: '/api/me/face-id',
      data: {
        image: 'new-jpeg',
        consent: true,
        expectedProfileId: 'current-profile',
      },
      timeout: 45_000,
    })
  })

  it('admin replacement pins the expected profile and never issues delete', async () => {
    await replaceFaceIdProfile(
      { kind: 'user', userEntryId: 123 },
      'new-jpeg',
      'current-profile'
    )
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith({
      url: '/api/users/123/face-id',
      data: {
        image: 'new-jpeg',
        consent: true,
        expectedProfileId: 'current-profile',
      },
      timeout: 45_000,
    })
    expect(mocks.authenticatedPost).not.toHaveBeenCalled()
  })
})
