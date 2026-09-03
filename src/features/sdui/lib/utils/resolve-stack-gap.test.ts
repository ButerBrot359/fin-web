import { describe, expect, it } from 'vitest'

import { resolveStackGap } from './resolve-stack-gap'

describe('resolveStackGap', () => {
  it('без пропа — пол дизайн-ритма 16px', () => {
    expect(resolveStackGap(undefined)).toBe(16)
  })

  it('явный 0 уважается (компоновка встык)', () => {
    expect(resolveStackGap(0)).toBe(0)
  })

  it('нормальная шкала проходит как есть (×4)', () => {
    expect(resolveStackGap(2)).toBe(8)
    expect(resolveStackGap(4)).toBe(16)
    expect(resolveStackGap(8)).toBe(32)
  })

  it('кривой конфиг клампится: gap:16 («Графики работы») → 32px, не 64px', () => {
    expect(resolveStackGap(16)).toBe(32)
  })

  it('отрицательное значение не ломает рендер', () => {
    expect(resolveStackGap(-3)).toBe(0)
  })
})
