import { describe, expect, it } from 'vitest'

import { kalendariTableKind } from './table-node'

describe('kalendariTableKind', () => {
  it('binding ShablonZapolneniya → template', () => {
    expect(kalendariTableKind('ShablonZapolneniya')).toBe('template')
  })
  it('binding RaspisanieRaboty → schedule', () => {
    expect(kalendariTableKind('RaspisanieRaboty')).toBe('schedule')
  })
  it('прочие binding → null', () => {
    expect(kalendariTableKind('SomeOtherTable')).toBeNull()
    expect(kalendariTableKind(undefined)).toBeNull()
  })
})
