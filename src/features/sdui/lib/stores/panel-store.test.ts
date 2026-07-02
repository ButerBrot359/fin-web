import { beforeEach, describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import { usePanelStore, type PanelEntry } from './panel-store'

const entry = (id: string, sessionId?: string): PanelEntry => ({
  panelId: id,
  node: { id, type: 'PAGE' } as ViewNode,
  presentation: 'modal',
  viewState: {},
  session: sessionId
    ? { formSessionId: sessionId, revision: 1 }
    : undefined,
})

describe('panel-store', () => {
  beforeEach(() => usePanelStore.getState().reset())

  it('push/pop/remove управляют стеком', () => {
    const s = usePanelStore.getState()
    s.push(entry('a'))
    s.push(entry('b'))
    usePanelStore.getState().pop()
    expect(usePanelStore.getState().panels.map((p) => p.panelId)).toEqual(['a'])
    usePanelStore.getState().remove('a')
    expect(usePanelStore.getState().panels).toEqual([])
  })

  it('updateSession обновляет ревизию нужной панели', () => {
    usePanelStore.getState().push(entry('a', 'fs-1'))
    usePanelStore.getState().updateSession('a', 5)
    expect(usePanelStore.getState().findBySessionId('fs-1')?.session?.revision).toBe(5)
  })
})
