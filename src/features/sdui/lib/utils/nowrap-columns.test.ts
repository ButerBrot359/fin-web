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

  // Тот же реквизит в ТЧ движений бухрегистра и разделений по шаблонам
  // приезжает под именами с суффиксом — значения там те же длинные.
  it.each([
    'IstochnikFinansirovaniyaDt',
    'IstochnikFinansirovaniyaKt',
    'IstochnikFinansirovaniyaNaRazdelenie',
  ])('%s — тот же «Источник финансирования»', (binding) => {
    expect(isNoWrapBinding(binding)).toBe(true)
  })

  it('чужой биндинг с другим началом под правило не попадает', () => {
    expect(isNoWrapBinding('VidIstochnikaFinansirovaniya')).toBe(false)
  })
})
