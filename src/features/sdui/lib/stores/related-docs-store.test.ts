import { beforeEach, describe, expect, it } from 'vitest'

import { useRelatedDocsStore } from './related-docs-store'

describe('related-docs-store', () => {
  beforeEach(() => {
    useRelatedDocsStore.getState().reset()
  })

  it('select пишет выделение по anchorId, не задевая другие панели', () => {
    const { select } = useRelatedDocsStore.getState()
    select('a1', { rowId: 'r1', isDeletionMarked: false })
    select('a2', { rowId: 'r9', isDeletionMarked: true })
    expect(useRelatedDocsStore.getState().selected.a1).toEqual({
      rowId: 'r1',
      isDeletionMarked: false,
    })
    expect(useRelatedDocsStore.getState().selected.a2).toEqual({
      rowId: 'r9',
      isDeletionMarked: true,
    })
  })

  it('select(anchorId, null) снимает выделение', () => {
    const { select } = useRelatedDocsStore.getState()
    select('a1', { rowId: 'r1', isDeletionMarked: false })
    select('a1', null)
    expect(useRelatedDocsStore.getState().selected.a1).toBeUndefined()
  })
})
