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
    openRouteInNewTab: vi.fn(),
    replaceUrl: vi.fn(),
  }
}

describe('effect navigate — openInNewTab', () => {
  it('с флагом открывает маршрут отдельной вкладкой и не закрывает сессию источника', () => {
    const deps = makeDeps()
    createEffectHandler(deps).play({
      type: 'navigate',
      route: '/documents/SchetKOplate/new?basisId=27856789',
      openInNewTab: true,
    })
    expect(deps.openRouteInNewTab).toHaveBeenCalledWith(
      '/documents/SchetKOplate/new?basisId=27856789'
    )
    expect(deps.navigate).not.toHaveBeenCalled()
    expect(deps.closeSession).not.toHaveBeenCalled()
  })

  it('без флага — прежнее поведение: переход в текущей вкладке + закрытие сессии', () => {
    const deps = makeDeps()
    createEffectHandler(deps).play({
      type: 'navigate',
      route: '/modules/gp/document/ZayavkaGP',
      openInNewTab: false,
    })
    expect(deps.navigate).toHaveBeenCalledWith('/modules/gp/document/ZayavkaGP')
    expect(deps.closeSession).toHaveBeenCalledTimes(1)
    expect(deps.openRouteInNewTab).not.toHaveBeenCalled()
  })

  it('поля нет вовсе (старый бэк) — прежнее поведение', () => {
    const deps = makeDeps()
    createEffectHandler(deps).play({ type: 'navigate', route: '/modules/gp' })
    expect(deps.navigate).toHaveBeenCalledWith('/modules/gp')
    expect(deps.openRouteInNewTab).not.toHaveBeenCalled()
  })
})

describe('effect replaceUrl (SCRUM-291 §7 персист)', () => {
  it('вызывает инъектированный replaceUrl с route из эффекта', () => {
    const deps = makeDeps()
    createEffectHandler(deps).play({
      type: 'replaceUrl',
      route: '/modules/gp/document/ZayavkaGP?ls=f1.eyJz',
    })
    expect(deps.replaceUrl).toHaveBeenCalledWith(
      '/modules/gp/document/ZayavkaGP?ls=f1.eyJz'
    )
  })

  it('не закрывает сессию и не навигирует (в отличие от navigate)', () => {
    const deps = makeDeps()
    createEffectHandler(deps).play({
      type: 'replaceUrl',
      route: '/modules/gp/document/ZayavkaGP?ls=f1.eyJz',
    })
    expect(deps.navigate).not.toHaveBeenCalled()
    expect(deps.closeSession).not.toHaveBeenCalled()
  })
})

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
      confirmCommand:
        'nav.saveAndOpen:INFORMATION_REGISTER:VoinskiyUchet:FizicheskoeLitso',
    })
    expect(deps.confirm).toHaveBeenCalledWith(
      'nav.saveAndOpen:INFORMATION_REGISTER:VoinskiyUchet:FizicheskoeLitso',
      'Данные будут записаны.'
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
