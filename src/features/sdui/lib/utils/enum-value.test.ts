import { describe, expect, it } from 'vitest'

import { resolveEnumValue } from './enum-value'

const options = [
  { value: 'week', label: 'По неделям', id: 31, code: 'PoNedelyam' },
  {
    value: 'cycle',
    label: 'По циклам',
    id: 32,
    code: 'PoTsiklamProizvolnoyDliny',
  },
]

describe('resolveEnumValue', () => {
  it('строка-код возвращается как есть (совпадает с option.value)', () => {
    expect(resolveEnumValue('week', options)).toBe('week')
  })
  it('полный объект матчится по code', () => {
    expect(
      resolveEnumValue(
        {
          id: 32,
          code: 'PoTsiklamProizvolnoyDliny',
          presentation: 'По циклам',
        },
        options
      )
    ).toBe('cycle')
  })
  it('полный объект матчится по id, если code отсутствует', () => {
    expect(resolveEnumValue({ id: 31 }, options)).toBe('week')
  })
  it('null/undefined → пустая строка', () => {
    expect(resolveEnumValue(null, options)).toBe('')
    expect(resolveEnumValue(undefined, options)).toBe('')
  })
  it('нет совпадения → пустая строка', () => {
    expect(resolveEnumValue({ code: 'Unknown' }, options)).toBe('')
  })
  it('выбранный объект матчится по value у опций без id и code', () => {
    const vidyNaloga = [
      { value: 'IPN', label: 'Индивидуальный подоходный налог' },
      { value: 'SN', label: 'Социальный налог' },
    ]
    expect(
      resolveEnumValue(
        { id: 'SN', code: 'SN', presentation: 'Социальный налог' },
        vidyNaloga
      )
    ).toBe('SN')
  })
  it('объект не матчится по value, если у опций есть id и code', () => {
    expect(resolveEnumValue({ code: 'week' }, options)).toBe('')
  })
})
