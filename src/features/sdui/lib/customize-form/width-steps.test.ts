import { describe, expect, it } from 'vitest'

import { stepToWidth, widthToStep } from './width-steps'

describe('widthToStep', () => {
  it('undefined — авто, точные значения ступеней — сами ступени', () => {
    expect(widthToStep(undefined)).toBe('auto')
    expect(widthToStep(160)).toBe('narrow')
    expect(widthToStep(320)).toBe('medium')
    expect(widthToStep(480)).toBe('wide')
  })

  it('произвольный px (например, от ИИ-помощника) ложится на ближайшую ступень', () => {
    expect(widthToStep(100)).toBe('narrow')
    expect(widthToStep(250)).toBe('medium')
    expect(widthToStep(410)).toBe('wide')
    expect(widthToStep(10_000)).toBe('wide')
    expect(widthToStep(0)).toBe('narrow')
  })

  it('равноудалённое значение уходит к МЕНЬШЕЙ ступени (строгое сравнение дистанций)', () => {
    // 240 ровно между 160 и 320: побеждает первая по списку — narrow.
    expect(widthToStep(240)).toBe('narrow')
    expect(widthToStep(241)).toBe('medium')
    expect(widthToStep(400)).toBe('medium')
    expect(widthToStep(401)).toBe('wide')
  })
})

describe('stepToWidth', () => {
  it('ступень отдаёт свой px, auto — undefined (проп снимается)', () => {
    expect(stepToWidth('auto')).toBeUndefined()
    expect(stepToWidth('narrow')).toBe(160)
    expect(stepToWidth('medium')).toBe(320)
    expect(stepToWidth('wide')).toBe(480)
  })

  it('ступени обратимы: widthToStep(stepToWidth(x)) === x', () => {
    for (const step of ['narrow', 'medium', 'wide'] as const) {
      expect(widthToStep(stepToWidth(step))).toBe(step)
    }
  })
})
