import { describe, it, expect } from 'vitest'

import {
  selectionModeToSearchParams,
  mergeSearchParams,
} from './field-filter-params'

describe('selectionModeToSearchParams', () => {
  it('GROUP → { groupsOnly: "true" }', () => {
    expect(selectionModeToSearchParams('GROUP')).toEqual({
      groupsOnly: 'true',
    })
  })

  it('другие режимы и отсутствие значения → undefined (без отбора)', () => {
    expect(selectionModeToSearchParams('GROUP_AND_ELEMENT')).toBeUndefined()
    expect(selectionModeToSearchParams('ELEMENT')).toBeUndefined()
    expect(selectionModeToSearchParams(null)).toBeUndefined()
    expect(selectionModeToSearchParams(undefined)).toBeUndefined()
  })

  it('groupsOnly объединяется с af-фильтром через mergeSearchParams', () => {
    expect(
      mergeSearchParams(
        { af: 'Organizatsiya:30294' },
        selectionModeToSearchParams('GROUP')
      )
    ).toEqual({ af: 'Organizatsiya:30294', groupsOnly: 'true' })
  })
})
