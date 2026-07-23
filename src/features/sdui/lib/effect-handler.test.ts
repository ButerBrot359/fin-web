import { describe, expect, it, vi } from 'vitest'

import { createEffectHandler, type EffectHandlerDeps } from './effect-handler'

function makeDeps(): EffectHandlerDeps {
  return {
    navigate: vi.fn(),
    closeSession: vi.fn().mockResolvedValue(undefined),
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    invalidateLists: vi.fn(),
    confirm: vi.fn(),
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

describe('effect confirm (SCRUM-244 v3 §1)', () => {
  it('прокидывает message и confirmCommand в мост confirm', () => {
    const deps = makeDeps()
    createEffectHandler(deps).play({
      type: 'confirm',
      message: 'Данные будут записаны.',
      confirmCommand: 'nav.saveAndOpen:INFORMATION_REGISTER:VoinskiyUchet:FizicheskoeLitso',
    })
    expect(deps.confirm).toHaveBeenCalledWith(
      'nav.saveAndOpen:INFORMATION_REGISTER:VoinskiyUchet:FizicheskoeLitso',
      'Данные будут записаны.',
    )
  })

  it('пустые поля резолвятся в пустые строки, а не undefined', () => {
    const deps = makeDeps()
    createEffectHandler(deps).play({ type: 'confirm' })
    expect(deps.confirm).toHaveBeenCalledWith('', '')
  })

  it('playAll обрывается на первом confirm — последующие эффекты не играют (§1.3)', () => {
    const deps = makeDeps()
    createEffectHandler(deps).playAll([
      { type: 'confirm', message: 'm', confirmCommand: 'c' },
      { type: 'notify', level: 'info', message: 'не должен показаться' },
      { type: 'refresh' },
    ])
    expect(deps.confirm).toHaveBeenCalledTimes(1)
    expect(deps.invalidateLists).not.toHaveBeenCalled()
  })

  it('playAll играет эффекты до confirm включительно', () => {
    const deps = makeDeps()
    createEffectHandler(deps).playAll([
      { type: 'refresh' },
      { type: 'confirm', message: 'm', confirmCommand: 'c' },
      { type: 'refresh' },
    ])
    expect(deps.invalidateLists).toHaveBeenCalledTimes(1)
    expect(deps.confirm).toHaveBeenCalledTimes(1)
  })
})
