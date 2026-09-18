import { describe, expect, it, vi } from 'vitest'

import type { ViewResponse } from '../types/view'
import { applyOpenPatches, applyServerPatches } from './apply-view-response'

// Мок-приёмник пишет имена вызовов в общий журнал — тест пиннит ПОРЯДОК
// применения ответа: ревизия → сброс ошибок → патчи дерева → патчи значений →
// merge(statePatch) → серверный dirty → эффекты.
function makeSink(calls: string[]) {
  const log = (name: string) => vi.fn(() => calls.push(name))
  return {
    bumpRevision: log('bumpRevision'),
    clearAllErrors: log('clearAllErrors'),
    applyTreePatches: log('applyTreePatches'),
    setFromServer: log('setFromServer'),
    merge: log('merge'),
    setDirty: log('setDirty'),
  }
}

const response = {
  formSessionId: 'fs-1',
  revision: 7,
  patches: [{ op: 'setValue', binding: 'Nomer', value: '42' }],
  statePatch: { Nomer: '42' },
  effects: [{ type: 'navigate', route: '/x' }],
} as unknown as ViewResponse

describe('applyServerPatches: порядок применения ответа EVENT/COMMAND', () => {
  it('bumpRevision → clearAllErrors → патчи дерева → патчи значений → merge → эффекты', () => {
    const calls: string[] = []
    const sink = makeSink(calls)
    const playEffects = vi.fn(() => calls.push('playEffects'))

    applyServerPatches(sink, response, { clearErrors: true, playEffects })

    expect(calls).toEqual([
      'bumpRevision',
      'clearAllErrors',
      'applyTreePatches',
      'setFromServer',
      'merge',
      'playEffects',
    ])
    expect(sink.bumpRevision).toHaveBeenCalledWith(7)
    expect(sink.applyTreePatches).toHaveBeenCalledWith(response.patches)
    expect(sink.setFromServer).toHaveBeenCalledWith('Nomer', '42')
    expect(sink.merge).toHaveBeenCalledWith({ Nomer: '42' })
    expect(playEffects).toHaveBeenCalledWith(response.effects)
  })

  it('clearErrors: false (EVENT) — ошибки не сбрасываются, остальной порядок тот же', () => {
    const calls: string[] = []
    const sink = makeSink(calls)

    applyServerPatches(sink, response, {
      clearErrors: false,
      playEffects: () => calls.push('playEffects'),
    })

    expect(calls).toEqual([
      'bumpRevision',
      'applyTreePatches',
      'setFromServer',
      'merge',
      'playEffects',
    ])
  })

  it('панельный sink без bumpRevision/setDirty — не падает, ревизию не трогает', () => {
    const calls: string[] = []
    const { bumpRevision, setDirty, ...panelSink } = makeSink(calls)

    applyServerPatches(panelSink, response, {
      clearErrors: true,
      playEffects: () => calls.push('playEffects'),
    })

    expect(bumpRevision).not.toHaveBeenCalled()
    expect(setDirty).not.toHaveBeenCalled()
    expect(calls).toEqual([
      'clearAllErrors',
      'applyTreePatches',
      'setFromServer',
      'merge',
      'playEffects',
    ])
  })

  it('серверный dirty применяется между merge и эффектами (SCRUM-288 §2.5)', () => {
    const calls: string[] = []
    const sink = makeSink(calls)

    applyServerPatches(sink, { ...response, dirty: false } as ViewResponse, {
      clearErrors: true,
      playEffects: () => calls.push('playEffects'),
    })

    expect(sink.setDirty).toHaveBeenCalledWith(false)
    expect(calls.indexOf('setDirty')).toBeGreaterThan(calls.indexOf('merge'))
    expect(calls.indexOf('setDirty')).toBeLessThan(calls.indexOf('playEffects'))
  })

  it('formDirty=true латчит dirty; dirty=null его не перекрывает (SCRUM-276)', () => {
    const calls: string[] = []
    const sink = makeSink(calls)

    applyServerPatches(
      sink,
      { ...response, dirty: null, formDirty: true } as ViewResponse,
      { clearErrors: true, playEffects: () => undefined }
    )

    expect(sink.setDirty).toHaveBeenCalledTimes(1)
    expect(sink.setDirty).toHaveBeenCalledWith(true)
  })

  it('dirty отсутствует и formDirty=false — setDirty не зовём', () => {
    const calls: string[] = []
    const sink = makeSink(calls)

    applyServerPatches(
      sink,
      { ...response, formDirty: false } as ViewResponse,
      { clearErrors: true, playEffects: () => undefined }
    )

    expect(sink.setDirty).not.toHaveBeenCalled()
  })
})

describe('applyOpenPatches: ответ OPEN', () => {
  it('только патчи и эффекты — без ревизии, сброса ошибок и merge', () => {
    const calls: string[] = []
    const sink = makeSink(calls)

    applyOpenPatches(sink, response, () => calls.push('playEffects'))

    expect(calls).toEqual(['applyTreePatches', 'setFromServer', 'playEffects'])
    expect(sink.merge).not.toHaveBeenCalled()
    expect(sink.clearAllErrors).not.toHaveBeenCalled()
  })
})
