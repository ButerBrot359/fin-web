import { describe, it, expect } from 'vitest'
import { isNoWrapBinding } from './nowrap-columns'

describe('isNoWrapBinding', () => {
  it('«Источник финансирования» исключён из переноса', () => {
    expect(isNoWrapBinding('IstochnikFinansirovaniya')).toBe(true)
  })

  it('регистр биндинга не важен', () => {
    expect(isNoWrapBinding('istochnikFinansirovaniya')).toBe(true)
  })

  it('остальные колонки ТЧ переносят текст как прежде', () => {
    expect(isNoWrapBinding('VidNachisleniya')).toBe(false)
    expect(isNoWrapBinding('KodPlatnykhUslug')).toBe(false)
  })

  it('однокоренной, но другой биндинг под правило не попадает', () => {
    expect(isNoWrapBinding('IstochnikFinansirovaniyaDt')).toBe(false)
  })
})
