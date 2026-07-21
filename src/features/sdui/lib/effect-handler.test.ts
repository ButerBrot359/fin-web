import { describe, expect, it, vi } from 'vitest'

import { createEffectHandler, type EffectHandlerDeps } from './effect-handler'

function makeDeps(): EffectHandlerDeps {
  return {
    navigate: vi.fn(),
    closeSession: vi.fn().mockResolvedValue(undefined),
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    invalidateLists: vi.fn(),
  }
}

describe('effect refresh', () => {
  it('вызывает инвалидацию списков', () => {
    const deps = makeDeps()
    const handler = createEffectHandler(deps)
    handler.play({ type: 'refresh' })
    expect(deps.invalidateLists).toHaveBeenCalledTimes(1)
  })

  it('не задевает другие зависимости', () => {
    const deps = makeDeps()
    createEffectHandler(deps).play({ type: 'refresh' })
    expect(deps.navigate).not.toHaveBeenCalled()
    expect(deps.openDialog).not.toHaveBeenCalled()
  })
})
