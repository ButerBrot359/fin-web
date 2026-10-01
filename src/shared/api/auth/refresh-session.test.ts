// SCRUM-308 v5 §6: продление сессии сериализуется между вкладками (Web Locks),
// и дождавшийся замка не жжёт refresh-токен, если сосед уже продлил сессию.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { requestRefresh } from './auth-endpoints'
import { refreshSession } from './refresh-session'
import { saveSession } from './token-storage'

vi.mock('./auth-endpoints', () => ({
  requestRefresh: vi.fn(),
}))

const user = { id: '1', login: 'user' }

describe('refreshSession — межвкладочный замок', () => {
  beforeEach(() => {
    localStorage.clear()
    saveSession('access-stale', 'refresh-1', user as never)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('под замком: если access не менялся — продлевает и сохраняет новую пару', async () => {
    vi.stubGlobal('navigator', {
      locks: {
        request: (_name: string, cb: () => Promise<unknown>) => cb(),
      },
    })
    vi.mocked(requestRefresh).mockResolvedValue({
      accessToken: 'access-new',
      refreshToken: 'refresh-2',
      user,
    } as never)

    await expect(refreshSession()).resolves.toBe('access-new')
    expect(requestRefresh).toHaveBeenCalledWith('refresh-1')
    expect(localStorage.getItem('webbuh.auth.refreshToken')).toBe('refresh-2')
  })

  it('сосед продлил, пока ждали замок — берёт его access и не жжёт refresh', async () => {
    vi.stubGlobal('navigator', {
      locks: {
        request: (_name: string, cb: () => Promise<unknown>) => {
          // Пока «эта вкладка» ждала замок, соседняя успела продлить сессию.
          saveSession('access-from-neighbor', 'refresh-2', user as never)
          return cb()
        },
      },
    })

    await expect(refreshSession()).resolves.toBe('access-from-neighbor')
    expect(requestRefresh).not.toHaveBeenCalled()
  })

  it('без Web Locks остаётся одновкладочный single-flight', async () => {
    vi.stubGlobal('navigator', {})
    vi.mocked(requestRefresh).mockResolvedValue({
      accessToken: 'access-new',
      refreshToken: 'refresh-2',
      user,
    } as never)

    await expect(refreshSession()).resolves.toBe('access-new')
    expect(requestRefresh).toHaveBeenCalledTimes(1)
  })
})
