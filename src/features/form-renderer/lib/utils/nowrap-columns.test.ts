import { describe, it, expect } from 'vitest'
import type { DocumentAttribute } from '@/entities/document-type'
import { isNoWrapColumn } from './nowrap-columns'

const col = (code1C: string, code = ''): DocumentAttribute =>
  ({ code1C, code, dataType: 'STRING' }) as DocumentAttribute

describe('isNoWrapColumn', () => {
  it('«Источник финансирования» по 1С-имени исключён из переноса', () => {
    expect(isNoWrapColumn(col('ИсточникФинансирования'))).toBe(true)
  })

  // Тот же реквизит в ТЧ движений бухрегистра и разделений по шаблонам.
  it.each([
    'ИсточникФинансированияДт',
    'ИсточникФинансированияКт',
    'ИсточникФинансированияНаРазделение',
  ])('%s — тот же «Источник финансирования»', (code1C) => {
    expect(isNoWrapColumn(col(code1C))).toBe(true)
  })

  // Часть типов приезжает без code1C — тогда работает фолбэк по code.
  it('без 1С-имени опознаётся по транслитерированному code', () => {
    expect(isNoWrapColumn(col('', 'istochnikFinansirovaniya'))).toBe(true)
    expect(isNoWrapColumn(col('', 'IstochnikFinansirovaniyaDt'))).toBe(true)
  })

  it('остальные колонки ТЧ переносят текст как прежде', () => {
    expect(isNoWrapColumn(col('ВидНачисления', 'vidNachisleniya'))).toBe(false)
    expect(isNoWrapColumn(col('Сумма', 'summa'))).toBe(false)
  })

  it('чужое имя с другим началом под правило не попадает', () => {
    expect(isNoWrapColumn(col('ВидИсточникаФинансирования'))).toBe(false)
  })
})
