import { beforeEach, describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import { usePanelStore, type PanelEntry } from './panel-store'

const node = { id: 'n1', type: 'PAGE' } as ViewNode

const entry = (id: string, sessionId?: string): PanelEntry => ({
  panelId: id,
  node: { id, type: 'PAGE' } as ViewNode,
  presentation: 'modal',
  viewState: {},
  session: sessionId ? { formSessionId: sessionId, revision: 1 } : undefined,
})

describe('panel-store', () => {
  beforeEach(() => usePanelStore.setState({ panels: [] }))

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
    expect(
      usePanelStore.getState().findBySessionId('fs-1')?.session?.revision
    ).toBe(5)
  })
})

// §3.2 спеки вложенного openDialog: закрытие родителя закрывает и вложенные.
// Проверяем позиционным правилом, а не по parentSessionId: панель выбора
// приезжает БЕЗ своей сессии, и ссылки на родителя у неё нет.
describe('panel-store — каскадное закрытие', () => {
  beforeEach(() => {
    usePanelStore.setState({ panels: [] })
  })

  const ids = () => usePanelStore.getState().panels.map((p) => p.panelId)

  it('закрытие родителя убирает и открытые поверх него панели', () => {
    const s = usePanelStore.getState()
    s.push(entry('rowForm', 'fs-1'))
    s.push(entry('choice')) // без сессии — как реальная панель выбора
    usePanelStore.getState().remove('rowForm')
    expect(ids()).toEqual([])
  })

  it('закрытие верхней не трогает родителя', () => {
    const s = usePanelStore.getState()
    s.push(entry('rowForm', 'fs-1'))
    s.push(entry('choice'))
    usePanelStore.getState().remove('choice')
    expect(ids()).toEqual(['rowForm'])
  })

  it('панели под закрываемой остаются', () => {
    const s = usePanelStore.getState()
    s.push(entry('under'))
    s.push(entry('target'))
    s.push(entry('above'))
    usePanelStore.getState().remove('target')
    expect(ids()).toEqual(['under'])
  })

  // Workspace-вкладка живёт не в стеке диалогов: закрытие чужого диалога её
  // касаться не должно, даже если она оказалась выше по массиву.
  it('панель workspace-вкладки каскадом не закрывается', () => {
    const s = usePanelStore.getState()
    s.push(entry('rowForm', 'fs-1'))
    s.push({
      panelId: 'tab',
      node,
      presentation: 'page',
      viewState: {},
      openInWorkspaceTab: true,
      tabKey: 'movements:1',
    })
    usePanelStore.getState().remove('rowForm')
    expect(ids()).toEqual(['tab'])
  })

  it('неизвестный id ничего не закрывает', () => {
    usePanelStore.getState().push(entry('a'))
    usePanelStore.getState().remove('нет-такой')
    expect(ids()).toEqual(['a'])
  })
})

describe('panel-store reset', () => {
  beforeEach(() => {
    usePanelStore.setState({ panels: [] })
  })

  it('сбрасывает диалоги, но сохраняет панели workspace-вкладок', () => {
    usePanelStore.getState().push({
      panelId: 'dlg',
      node,
      presentation: 'modal',
      viewState: {},
    })
    usePanelStore.getState().push({
      panelId: 'tab',
      node,
      presentation: 'page',
      viewState: {},
      openInWorkspaceTab: true,
      tabKey: 'movements:1',
    })
    usePanelStore.getState().reset()
    const panels = usePanelStore.getState().panels
    expect(panels).toHaveLength(1)
    expect(panels[0].panelId).toBe('tab')
  })
})
