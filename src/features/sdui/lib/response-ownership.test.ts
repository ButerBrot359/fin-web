import { afterEach, describe, expect, it } from 'vitest'

import type { SduiSessionValue } from './sdui-session-context'
import { captureResponseOwner, classifyResponse } from './response-ownership'
import { setWorkspaceTabGateway } from './workspace-tab-gateway'
import {
  deferResponse,
  deferrableEffects,
  dropDeferredResponses,
  replayDeferredResponses,
} from './deferred-responses'

const rootSession = (formSessionId: string | null): SduiSessionValue =>
  ({
    kind: 'root',
    getSession: () => ({ formSessionId, revision: 1 }),
  }) as SduiSessionValue

// jsdom: страница живёт на «/» — маршрут владельца подбирается относительно него
const CURRENT_ROUTE = window.location.pathname + window.location.search

afterEach(() => {
  setWorkspaceTabGateway(null)
})

describe('classifyResponse (SCRUM-308 v1 §5, владение ответом)', () => {
  it('сессия на экране та же, что у владельца → active', () => {
    const session = rootSession('fs-1')
    const owner = captureResponseOwner(session, '/anywhere')
    expect(classifyResponse(owner, session)).toBe('active')
  })

  it('маршрут тот же, но сессия переоткрыта → orphaned (старая revision не должна утопить новую)', () => {
    const owner = captureResponseOwner(rootSession('fs-1'), CURRENT_ROUTE)
    expect(classifyResponse(owner, rootSession('fs-2'))).toBe('orphaned')
  })

  it('чужая сессия на экране, вкладка владельца жива → deferred', () => {
    setWorkspaceTabGateway({
      openPanelTab: () => undefined,
      armNewTab: () => undefined,
      isRouteOpen: (route) => route === '/dictionaries/Polzovateli/1',
    })
    const owner = captureResponseOwner(
      rootSession('fs-1'),
      '/dictionaries/Polzovateli/1'
    )
    expect(classifyResponse(owner, rootSession('fs-2'))).toBe('deferred')
  })

  it('чужая сессия на экране, вкладка владельца закрыта → orphaned', () => {
    setWorkspaceTabGateway({
      openPanelTab: () => undefined,
      armNewTab: () => undefined,
      isRouteOpen: () => false,
    })
    const owner = captureResponseOwner(
      rootSession('fs-1'),
      '/dictionaries/Polzovateli/1'
    )
    expect(classifyResponse(owner, rootSession('fs-2'))).toBe('orphaned')
  })

  it('панель — всегда active: её приёмник сам дропает патчи после закрытия', () => {
    const panel = {
      ...rootSession('fs-1'),
      kind: 'panel',
    } as SduiSessionValue
    const owner = captureResponseOwner(panel, '/somewhere')
    expect(classifyResponse(owner, rootSession('fs-2'))).toBe('active')
  })
})

describe('deferred-responses', () => {
  it('deferrableEffects пропускает только пользовательские эффекты', () => {
    const effects = deferrableEffects([
      { type: 'notify', message: 'x' },
      { type: 'navigate', url: '/y' },
      { type: 'refresh' },
      { type: 'alert', message: 'z' },
    ] as never)
    expect(effects.map((e) => e.type)).toEqual(['notify', 'alert'])
  })

  it('replay проигрывает колбэки FIFO и очищает маршрут', () => {
    const played: string[] = []
    deferResponse('/r1', () => played.push('a'))
    deferResponse('/r1', () => played.push('b'))
    replayDeferredResponses('/r1')
    expect(played).toEqual(['a', 'b'])
    replayDeferredResponses('/r1')
    expect(played).toEqual(['a', 'b'])
  })

  it('drop выбрасывает отложенное закрытой вкладки', () => {
    const played: string[] = []
    deferResponse('/r2', () => played.push('a'))
    dropDeferredResponses('/r2')
    replayDeferredResponses('/r2')
    expect(played).toEqual([])
  })
})
