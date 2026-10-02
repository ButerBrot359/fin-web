import { afterEach, describe, expect, it } from 'vitest'

import {
  registerPendingFlush,
  unregisterPendingFlush,
} from '../pending-table-commits'
import { useViewStateStore } from '../stores/view-state-store'
import { hasUnsavedScreenWork } from './use-unload-guard'

describe('beforeunload-предупреждение (D7/D8)', () => {
  afterEach(() => {
    useViewStateStore.getState().replaceAll({})
  })

  it('набор в поле (view-state set) сразу ставит dirty — F5 предупреждает', () => {
    expect(hasUnsavedScreenWork()).toBe(false)
    useViewStateStore.getState().set('summa', '15')
    expect(useViewStateStore.getState().dirty).toBe(true)
    expect(hasUnsavedScreenWork()).toBe(true)
  })

  it('незавершённая правка ячейки ТЧ — F5 предупреждает', () => {
    const token = registerPendingFlush(
      () => Promise.resolve(),
      () => true
    )
    expect(hasUnsavedScreenWork()).toBe(true)
    unregisterPendingFlush(token)
    expect(hasUnsavedScreenWork()).toBe(false)
  })
})
