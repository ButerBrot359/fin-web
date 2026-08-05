import { describe, it, expect } from 'vitest'
import { resolveLoadedCountLabel } from './list-loaded-count'

const t = (key: string, opts?: Record<string, unknown>) =>
  `${key}:${JSON.stringify(opts ?? {})}`

describe('resolveLoadedCountLabel', () => {
  it('с totalElements → loadedCount с total', () => {
    expect(resolveLoadedCountLabel(t, 25, 100)).toBe(
      'table.loadedCount:{"loaded":25,"total":100}'
    )
  })

  it('без totalElements (Slice) → loadedCountNoTotal без total', () => {
    expect(resolveLoadedCountLabel(t, 25, undefined)).toBe(
      'table.loadedCountNoTotal:{"loaded":25}'
    )
  })
})
