import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiService } from '@/shared/api/api'

import { createEffectHandler, type EffectHandlerDeps } from './effect-handler'

vi.mock('@/shared/api/api', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    getFileBlob: vi.fn(),
    postFileBlob: vi.fn(),
  },
}))

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

describe('effect confirm (SCRUM-244 v3 §1 / SCRUM-288 §2.3)', () => {
  it('прокидывает весь эффект в мост confirm', () => {
    const deps = makeDeps()
    const effect = {
      type: 'confirm' as const,
      message: 'Данные будут записаны.',
      confirmCommand: 'nav.saveAndOpen:X',
    }
    createEffectHandler(deps).play(effect)
    expect(deps.confirm).toHaveBeenCalledWith(effect)
  })

  it('playAll обрывается на первом confirm (§1.3)', () => {
    const deps = makeDeps()
    createEffectHandler(deps).playAll([
      { type: 'confirm', message: 'm', confirmCommand: 'c' },
      { type: 'notify', level: 'info', message: 'не должен показаться' },
      { type: 'refresh' },
    ])
    expect(deps.confirm).toHaveBeenCalledTimes(1)
    expect(deps.invalidateLists).not.toHaveBeenCalled()
  })
})

describe('effect download (SCRUM-288 §3.1)', () => {
  // Мок apiService общий на модуль — без сброса вызовы одного теста утекают
  // в проверки соседнего (getFileBlob/postFileBlob не сбрасываются между it).
  beforeEach(() => {
    vi.mocked(apiService.getFileBlob).mockClear()
    vi.mocked(apiService.postFileBlob).mockClear()
  })

  it('есть request — POST через postFileBlob с телом', async () => {
    const blob = new Blob(['x'])
    vi.mocked(apiService.postFileBlob).mockResolvedValue({
      data: blob,
      headers: {},
    } as never)
    createEffectHandler(makeDeps()).play({
      type: 'download',
      request: {
        method: 'POST',
        url: '/api/reportalt/OSVPoSchetu/print',
        body: { parameters: {} },
      },
    })
    await Promise.resolve()
    expect(apiService.postFileBlob).toHaveBeenCalledWith({
      url: '/api/reportalt/OSVPoSchetu/print',
      data: { parameters: {} },
    })
    expect(apiService.getFileBlob).not.toHaveBeenCalled()
  })

  it('есть только url — прежний GET через getFileBlob', async () => {
    const blob = new Blob(['x'])
    vi.mocked(apiService.getFileBlob).mockResolvedValue({
      data: blob,
      headers: {},
    } as never)
    createEffectHandler(makeDeps()).play({
      type: 'download',
      url: '/api/print/42.pdf',
    })
    await Promise.resolve()
    expect(apiService.getFileBlob).toHaveBeenCalledWith({
      url: '/api/print/42.pdf',
    })
    expect(apiService.postFileBlob).not.toHaveBeenCalled()
  })
})

describe('executeActionRequest на хэндлере (SCRUM-288 §2.1)', () => {
  it('проигрывает эффекты ответа через playAll', async () => {
    vi.mocked(apiService.get).mockResolvedValue({
      data: { effects: [{ type: 'refresh' }] },
    } as never)
    const deps = makeDeps()
    await createEffectHandler(deps).executeActionRequest({ url: '/api/x?a=1' })
    expect(deps.invalidateLists).toHaveBeenCalledTimes(1)
  })
})
