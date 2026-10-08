import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { buildDispatchEffectHandler } from './build-dispatch-effect-deps'
import { consumeDiscardDraftClose } from './close-intent'
import { consumeAdoptedScreen, takeScreenRebind } from './screen-rebind'
import type { SduiSessionValue } from './sdui-session-context'

const CREATE_KEY = '/documents/VedomostIspolnitelnyeListy/new?fi=tab-1'
const RECORD_ROUTE = '/documents/VedomostIspolnitelnyeListy/4'

const build = (opts: { closeAfter?: boolean; kind?: 'root' | 'panel' }) => {
  const navigate = vi.fn()
  const handler = buildDispatchEffectHandler({
    navigate,
    session: {
      kind: opts.kind ?? 'root',
      getSession: () => ({ formSessionId: 'fs-1', revision: 1 }),
    } as unknown as SduiSessionValue,
    queryClient: new QueryClient(),
    setSearchParams: vi.fn(),
    pathname: CREATE_KEY,
    closeAfter: opts.closeAfter,
    redispatch: vi.fn(() => Promise.resolve(true)),
  })
  return { navigate, handler }
}

describe('buildDispatchEffectHandler: rebindRoute', () => {
  it('переводит адрес вкладки заменой истории и заказывает перенос формы', () => {
    const { navigate, handler } = build({})

    handler.play({ type: 'rebindRoute', route: RECORD_ROUTE })

    expect(navigate).toHaveBeenCalledWith(RECORD_ROUTE, { replace: true })
    expect(takeScreenRebind(CREATE_KEY, RECORD_ROUTE)).toBe(true)
    expect(consumeAdoptedScreen(RECORD_ROUTE)).toBe(true)
  })

  it('команда с закрытием вкладки и панельная сессия адрес не трогают', () => {
    for (const opts of [{ closeAfter: true }, { kind: 'panel' as const }]) {
      const { navigate, handler } = build(opts)

      handler.play({ type: 'rebindRoute', route: RECORD_ROUTE })

      expect(navigate).not.toHaveBeenCalled()
      expect(takeScreenRebind(CREATE_KEY, RECORD_ROUTE)).toBe(false)
    }
  })
})

describe('buildDispatchEffectHandler: closeForm', () => {
  const buildWithClose = (kind: 'root' | 'panel') => {
    const closeAfter = vi.fn()
    const handler = buildDispatchEffectHandler({
      navigate: vi.fn(),
      session: {
        kind,
        getSession: () => ({ formSessionId: 'fs-1', revision: 1 }),
        closeAfter,
      } as unknown as SduiSessionValue,
      queryClient: new QueryClient(),
      setSearchParams: vi.fn(),
      pathname: CREATE_KEY,
      redispatch: vi.fn(() => Promise.resolve(true)),
    })
    return { closeAfter, handler }
  }

  it('закрывает вкладку формы со сбросом черновика', () => {
    const { closeAfter, handler } = buildWithClose('root')

    handler.play({ type: 'closeForm' })

    expect(closeAfter).toHaveBeenCalledWith(false)
    expect(consumeDiscardDraftClose(CREATE_KEY)).toBe(true)
  })

  it('панельную сессию не трогает', () => {
    const { closeAfter, handler } = buildWithClose('panel')

    handler.play({ type: 'closeForm' })

    expect(closeAfter).not.toHaveBeenCalled()
    expect(consumeDiscardDraftClose(CREATE_KEY)).toBe(false)
  })
})
