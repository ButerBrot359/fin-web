import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewAction, ViewNode } from '../types/view'
import { useSduiCacheStore } from './stores/sdui-cache-store'
import { useTreeStore } from './stores/tree-store'
import { reopenFormForLanguageChange } from './language-reopen'

const node = { id: 'root', type: 'VSTACK', props: {}, children: [] } as unknown as ViewNode

describe('reopenFormForLanguageChange', () => {
  beforeEach(() => {
    useSduiCacheStore.setState({ cache: {} })
    useTreeStore.getState().setRoot(node)
    useTreeStore.getState().setSession('fs-old', 3)
  })

  it('CLOSE → сброс сторов и кэша route → OPEN c layoutCode', async () => {
    useSduiCacheStore.getState().save('/doc/1', {
      root: node,
      formSessionId: 'fs-old',
      revision: 3,
      viewState: {},
      dirty: false,
    })

    const actions: ViewAction[] = []
    const treeAtOpen: unknown[] = []
    const dispatch = vi.fn(async (action: ViewAction) => {
      actions.push(action)
      if (action.type === 'OPEN') treeAtOpen.push(useTreeStore.getState().root)
      return true
    })

    await reopenFormForLanguageChange({
      dispatch,
      route: '/doc/1',
      layoutCode: 'X.ФормаОбъекта',
    })

    expect(actions).toEqual([
      { type: 'CLOSE' },
      { type: 'OPEN', layoutCode: 'X.ФормаОбъекта' },
    ])
    // К моменту OPEN дерево сброшено (скелетон), кэш route очищен
    expect(treeAtOpen).toEqual([null])
    expect(useSduiCacheStore.getState().get('/doc/1')).toBeUndefined()
  })

  it('ошибка CLOSE не блокирует OPEN (best-effort)', async () => {
    const dispatch = vi
      .fn<(action: ViewAction) => Promise<boolean>>()
      .mockResolvedValueOnce(false) // CLOSE упал (dispatch сам гасит ошибки тостом)
      .mockResolvedValueOnce(true) // OPEN
    await reopenFormForLanguageChange({ dispatch, route: '/doc/1' })
    expect(dispatch).toHaveBeenCalledTimes(2)
  })
})
