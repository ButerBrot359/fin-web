import { beforeEach, describe, expect, it } from 'vitest'

import { useViewStateStore } from './view-state-store'

beforeEach(() => {
  useViewStateStore.setState({ state: {}, dirty: false })
})

describe('view-state-store setDirty (SCRUM-288 §2.5)', () => {
  it('setDirty(true) поднимает флаг, setDirty(false) — снимает', () => {
    useViewStateStore.getState().setDirty(true)
    expect(useViewStateStore.getState().dirty).toBe(true)
    useViewStateStore.getState().setDirty(false)
    expect(useViewStateStore.getState().dirty).toBe(false)
  })
})
