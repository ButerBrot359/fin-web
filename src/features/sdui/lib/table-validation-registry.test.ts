import { describe, it, expect, vi } from 'vitest'
import {
  registerRevealErrors,
  unregisterRevealErrors,
  revealAllTableErrors,
} from './table-validation-registry'

describe('table-validation-registry', () => {
  it('revealAll дёргает все зарегистрированные колбэки', () => {
    const a = vi.fn()
    const b = vi.fn()
    const ta = registerRevealErrors(a)
    const tb = registerRevealErrors(b)
    revealAllTableErrors()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    unregisterRevealErrors(ta)
    unregisterRevealErrors(tb)
  })
  it('снятый колбэк не дёргается', () => {
    const a = vi.fn()
    const t = registerRevealErrors(a)
    unregisterRevealErrors(t)
    revealAllTableErrors()
    expect(a).not.toHaveBeenCalled()
  })
})
