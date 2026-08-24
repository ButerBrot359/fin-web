import { describe, expect, it } from 'vitest'

import { toggleSelectedEntries } from './dict-sidebar-list-view'
import type { DictEntry } from '../api/dict-sidebar-api'

const employee = (id: number): DictEntry => ({
  id,
  code: String(id),
  nameRu: `Employee ${String(id)}`,
  nameKz: '',
  isActive: true,
  attributes: null,
})

describe('DictSidebarListView multi-select', () => {
  it('retains several checked entries and toggles only the addressed entry', () => {
    const one = employee(1)
    const two = employee(2)
    const selected = toggleSelectedEntries(
      toggleSelectedEntries(new Map(), one),
      two
    )

    expect([...selected.keys()]).toEqual([1, 2])
    expect([...toggleSelectedEntries(selected, one).keys()]).toEqual([2])
  })
})
