import { describe, expect, it } from 'vitest'

import { selectedIdsForScope } from './scoped-row-selection'

describe('selectedIdsForScope', () => {
  it('fails closed when the list query changes', () => {
    expect(
      selectedIdsForScope(
        { scope: 'Tabel:search=old', ids: [11, 12] },
        'Tabel:search=new'
      )
    ).toEqual([])
  })

  it('keeps selection for the query that rendered it', () => {
    expect(
      selectedIdsForScope(
        { scope: 'Tabel:search=current', ids: [11, 12] },
        'Tabel:search=current'
      )
    ).toEqual([11, 12])
  })
})
