import { describe, expect, it } from 'vitest'

import { buildTableMutationPolicy } from './table-mutation-policy'

describe('buildTableMutationPolicy (SCRUM-400 §5.6.1)', () => {
  it('readOnly ТЧ запрещает всё, независимо от allow*', () => {
    const p = buildTableMutationPolicy({
      tableReadOnly: true,
      allowAdd: true,
      allowDelete: true,
      allowReorder: true,
    })
    expect(p).toEqual({
      readOnly: true,
      canAdd: false,
      canDelete: false,
      canReorder: false,
    })
  })

  it('без readOnly решают allow*', () => {
    const p = buildTableMutationPolicy({
      tableReadOnly: false,
      allowAdd: true,
      allowDelete: false,
      allowReorder: true,
    })
    expect(p).toEqual({
      readOnly: false,
      canAdd: true,
      canDelete: false,
      canReorder: true,
    })
  })
})
