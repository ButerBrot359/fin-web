import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  notifySignedIn,
  runIdentityReset,
  seedLastUserId,
  setAuthLifecycleHooks,
} from './auth-lifecycle'

describe('auth-lifecycle — смена личности (SCRUM-400 §10)', () => {
  const identityReset = vi.fn()
  const signedIn = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    setAuthLifecycleHooks({
      onBeforeSignOut: () => undefined,
      onIdentityReset: identityReset,
      onSignedIn: signedIn,
    })
    runIdentityReset() // сброс lastUserId между тестами
    identityReset.mockClear()
  })

  it('вход другого пользователя после входа первого — сброс кэшей', () => {
    notifySignedIn(1)
    expect(identityReset).not.toHaveBeenCalled()
    notifySignedIn(2)
    expect(identityReset).toHaveBeenCalledTimes(1)
    expect(signedIn).toHaveBeenCalledTimes(2)
  })

  it('повторный вход того же пользователя кэши не трогает (§10 п.6)', () => {
    notifySignedIn(1)
    notifySignedIn(1)
    expect(identityReset).not.toHaveBeenCalled()
  })

  it('восстановленная из localStorage сессия сеется seedLastUserId — смена после неё распознаётся', () => {
    seedLastUserId(1)
    notifySignedIn(2)
    expect(identityReset).toHaveBeenCalledTimes(1)
  })
})
