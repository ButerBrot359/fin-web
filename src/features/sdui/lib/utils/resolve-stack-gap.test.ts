import { describe, expect, it } from 'vitest'

import { resolveStackGap, resolveStackPadding } from './resolve-stack-gap'

describe('resolveStackGap', () => {
  it('без пропа — пол дизайн-ритма 16px', () => {
    expect(resolveStackGap(undefined)).toBe(16)
  })

  it('явный 0 уважается (компоновка встык)', () => {
    expect(resolveStackGap(0)).toBe(0)
  })

  it('нормальная шкала проходит как есть (×4) до потолка 24', () => {
    expect(resolveStackGap(2)).toBe(8)
    expect(resolveStackGap(4)).toBe(16)
    expect(resolveStackGap(6)).toBe(24)
  })

  it('кривые конфиги клампятся к потолку 24: gap:8 (панели) и gap:16 (Графики работы)', () => {
    expect(resolveStackGap(8)).toBe(24)
    expect(resolveStackGap(16)).toBe(24)
  })

  it('отрицательное значение не ломает рендер', () => {
    expect(resolveStackGap(-3)).toBe(0)
  })
})

describe('resolveStackPadding', () => {
  it('без пропа и при нуле — 0', () => {
    expect(resolveStackPadding(undefined)).toBe(0)
    expect(resolveStackPadding(0)).toBe(0)
  })

  it('шкала ×4 с потолком 24: padding:16 (панель организации) → 24px, не 64px', () => {
    expect(resolveStackPadding(4)).toBe(16)
    expect(resolveStackPadding(16)).toBe(24)
  })
})
