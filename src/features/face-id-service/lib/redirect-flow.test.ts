import { beforeEach, describe, expect, it, vi } from 'vitest'

import { completeFaceId, startFaceId } from '../api/face-id-api'
import {
  createBrowserToken,
  finishFaceIdRedirect,
  parseFaceIdCallback,
  prepareFaceIdRedirect,
  safeFaceIdReturnPath,
} from './redirect-flow'

vi.mock('../api/face-id-api', () => ({
  startFaceId: vi.fn(),
  completeFaceId: vi.fn(),
}))

const state = 's'.repeat(43)
const code = 'c'.repeat(43)
const response = () => ({
  authorizationUrl: 'https://faceid.qazyna.ai/connect/flow?ticket=one-use',
  state,
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
})

describe('Face ID browser binding', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.resetAllMocks()
    vi.mocked(startFaceId).mockResolvedValue(response())
  })

  it.each([
    '//evil.test',
    'https://evil.test',
    '/\\evil.test',
    '/%2Fevil.test',
    '/%255Cevil.test',
    '/\n/evil.test',
    '%2F%2Fevil.test',
  ])('rejects unsafe return path %s', (path) => {
    expect(safeFaceIdReturnPath(path)).toBe('/')
  })

  it('keeps local paths and produces 256-bit random proofs', () => {
    expect(safeFaceIdReturnPath('/modules/example?filter=1')).toBe(
      '/modules/example?filter=1'
    )
    const first = createBrowserToken()
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(createBrowserToken()).not.toBe(first)
  })

  it('stores the proof before returning redirect; consumes once on completion', async () => {
    await prepareFaceIdRedirect('/modules/example')
    const browserToken = vi.mocked(startFaceId).mock.calls[0][0]
    expect(sessionStorage.getItem(`webbuh.face-id.${state}`)).toContain(
      browserToken
    )
    vi.mocked(completeFaceId).mockResolvedValue({
      user: { login: 'User' },
    } as never)
    const result = await finishFaceIdRedirect({ state, code })
    expect(completeFaceId).toHaveBeenCalledExactlyOnceWith({
      state,
      code,
      browserToken,
    })
    expect(result.returnPath).toBe('/modules/example')
    expect(sessionStorage.length).toBe(0)
    await expect(finishFaceIdRedirect({ state, code })).rejects.toThrow()
    expect(completeFaceId).toHaveBeenCalledTimes(1)
  })

  it('rejects duplicate or missing callback values', () => {
    expect(parseFaceIdCallback(`?state=${state}&code=${code}`)).toEqual({
      state,
      code,
    })
    expect(
      parseFaceIdCallback(`?state=${state}&state=${state}&code=${code}`)
    ).toBeNull()
    expect(
      parseFaceIdCallback(`?state=${state}&code=${code}&code=${code}`)
    ).toBeNull()
    expect(
      parseFaceIdCallback(`?state=${state}&code=${code}&error=denied`)
    ).toBeNull()
    expect(parseFaceIdCallback('?code=')).toBeNull()
  })

  it('fails closed on unknown state or expired proof before any POST', async () => {
    await expect(finishFaceIdRedirect({ state, code })).rejects.toThrow()
    sessionStorage.setItem(
      `webbuh.face-id.${state}`,
      JSON.stringify({
        browserToken: 'a'.repeat(43),
        expiresAt: Date.now() - 1,
        returnPath: '/',
      })
    )
    await expect(finishFaceIdRedirect({ state, code })).rejects.toThrow()
    expect(completeFaceId).not.toHaveBeenCalled()
  })

  it('does not retry a failed exchange and removes browser proof', async () => {
    await prepareFaceIdRedirect('/')
    vi.mocked(completeFaceId).mockRejectedValue(
      new Error('connection interrupted')
    )
    await expect(finishFaceIdRedirect({ state, code })).rejects.toThrow()
    await expect(finishFaceIdRedirect({ state, code })).rejects.toThrow()
    expect(completeFaceId).toHaveBeenCalledTimes(1)
    expect(sessionStorage.length).toBe(0)
  })

  it.each([
    'javascript:alert(1)',
    'http://evil.test/connect',
    'https://user:secret@faceid.qazyna.ai/connect',
  ])('rejects invalid redirect %s', async (authorizationUrl) => {
    vi.mocked(startFaceId).mockResolvedValue({
      ...response(),
      authorizationUrl,
    })
    await expect(prepareFaceIdRedirect('/')).rejects.toThrow()
    expect(sessionStorage.length).toBe(0)
  })
})
