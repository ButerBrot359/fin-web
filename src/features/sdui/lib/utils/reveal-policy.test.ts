import { describe, it, expect } from 'vitest'
import { shouldRevealTableErrors } from './reveal-policy'

describe('shouldRevealTableErrors', () => {
  it('COMMAND с flushPendingTables:true → true (save/post)', () => {
    expect(
      shouldRevealTableErrors(
        { type: 'COMMAND', command: 'save' },
        {
          flushPendingTables: true,
          resetsDirty: true,
          closeAfter: true,
        }
      )
    ).toBe(true)
  })
  it('reference-команда без behavior → false', () => {
    expect(
      shouldRevealTableErrors(
        { type: 'COMMAND', command: 'showAll' },
        undefined
      )
    ).toBe(false)
  })
  it('behavior.flushPendingTables:false → false (rowActivate/reference)', () => {
    expect(
      shouldRevealTableErrors(
        { type: 'COMMAND', command: 'x' },
        {
          flushPendingTables: false,
        }
      )
    ).toBe(false)
  })
  it('OPEN/EVENT → false', () => {
    expect(
      shouldRevealTableErrors({ type: 'OPEN' }, { flushPendingTables: true })
    ).toBe(false)
    expect(
      shouldRevealTableErrors(
        { type: 'EVENT', sourceNodeId: 'n' },
        { flushPendingTables: true }
      )
    ).toBe(false)
  })
})
