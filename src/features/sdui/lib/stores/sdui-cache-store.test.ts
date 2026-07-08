import { beforeEach, describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import { useSduiCacheStore } from './sdui-cache-store'

const node = { id: 'root', type: 'VSTACK', props: {}, children: [] } as unknown as ViewNode

const entry = (dirty: boolean) => ({
  root: node,
  formSessionId: 'fs-1',
  revision: 1,
  viewState: {},
  dirty,
})

describe('sdui-cache-store', () => {
  beforeEach(() => {
    useSduiCacheStore.setState({ cache: {} })
  })

  it('save/get сохраняет флаг dirty', () => {
    useSduiCacheStore.getState().save('/a', entry(true))
    expect(useSduiCacheStore.getState().get('/a')?.dirty).toBe(true)
  })

  it('clear() очищает весь кэш', () => {
    useSduiCacheStore.getState().save('/a', entry(false))
    useSduiCacheStore.getState().save('/b', entry(true))
    useSduiCacheStore.getState().clear()
    expect(useSduiCacheStore.getState().cache).toEqual({})
  })
})
