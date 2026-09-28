import { describe, expect, it } from 'vitest'

import { deserializeParam } from './params'
import type { ReportAltParameterDto } from '../../types/reportalt'

const vidNaloga: ReportAltParameterDto = {
  code: 'VidNaloga',
  titleRu: 'Вид налога',
  dataType: 'ENUM_REF',
  required: true,
  referenceDomain: 'VidyNalogovVznosovOtchisleniy',
  allowedValues: [
    {
      value: 'IPN',
      titleRu: 'Индивидуальный подоходный налог',
      titleKz: 'Жеке табыс салығы',
    },
    { value: 'SN', titleRu: 'Социальный налог', titleKz: 'Әлеуметтік салық' },
  ],
}

describe('deserializeParam для перечисления', () => {
  it('перечисление со списком вариантов восстанавливает код как строку', () => {
    expect(deserializeParam('IPN', vidNaloga)).toBe('IPN')
  })

  it('перечисление без списка вариантов по-прежнему восстанавливает id числом', () => {
    const bezVariantov: ReportAltParameterDto = {
      ...vidNaloga,
      allowedValues: [],
    }
    expect(deserializeParam('571', bezVariantov)).toBe(571)
    expect(deserializeParam('', bezVariantov)).toBe('')
  })
})
