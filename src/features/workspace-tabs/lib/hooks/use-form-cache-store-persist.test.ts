import { beforeEach, describe, expect, it } from 'vitest'

import {
  FORM_DIRTY_STORAGE_KEY,
  useFormCacheStore,
} from './use-form-cache-store'

const stored = (): unknown =>
  JSON.parse(sessionStorage.getItem(FORM_DIRTY_STORAGE_KEY) ?? 'null')

describe('useFormCacheStore: dirty вкладок переживает F5 (D5)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useFormCacheStore.setState({ cache: {}, pendingActions: {} })
  })

  it('в sessionStorage уходит только признак dirty, без значений и pending-действий', () => {
    useFormCacheStore.getState().setCachedValues('/a', { secret: 1 })
    useFormCacheStore.getState().setDirty('/b', false)
    useFormCacheStore.getState().setPendingAction('/a', 'save-and-close')

    expect(stored()).toMatchObject({
      state: { cache: { '/a': { values: null, isDirty: true } } },
    })
    expect(JSON.stringify(stored())).not.toContain('secret')
    expect(JSON.stringify(stored())).not.toContain('save-and-close')
  })

  it('после перезагрузки dirty восстанавливается', async () => {
    useFormCacheStore.getState().setDirty('/a', true)
    const snapshot = sessionStorage.getItem(FORM_DIRTY_STORAGE_KEY)
    useFormCacheStore.setState({ cache: {}, pendingActions: {} })
    sessionStorage.setItem(FORM_DIRTY_STORAGE_KEY, snapshot ?? '')

    await useFormCacheStore.persist.rehydrate()

    expect(useFormCacheStore.getState().cache['/a']?.isDirty).toBe(true)
  })

  it('сохранение (dirty=false), закрытие и discard снимают признак из хранилища', () => {
    useFormCacheStore.getState().setDirty('/saved', true)
    useFormCacheStore.getState().setDirty('/closed', true)
    useFormCacheStore.getState().setDirty('/saved', false)
    useFormCacheStore.getState().removeTab('/closed')

    expect(stored()).toMatchObject({ state: { cache: {} } })
  })
})
