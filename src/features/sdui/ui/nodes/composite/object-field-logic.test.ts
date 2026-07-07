import { describe, expect, it } from 'vitest'

import {
  sortAllowedTypes,
  findAllowedType,
  resolveSelectedTypeCode,
  buildObjectValue,
  type AllowedType,
} from './object-field-logic'

const orgs: AllowedType = {
  position: 2,
  domainKind: 'DICTIONARY',
  targetTypeCode: 'Organizacii',
  presentation: 'Организации',
  optionsSource: { url: '/api/dictionary-entries/Organizacii/entries' },
}
const contractors: AllowedType = {
  position: 1,
  domainKind: 'DICTIONARY',
  targetTypeCode: 'Kontragenty',
  presentation: 'Контрагенты',
  optionsSource: { url: '/api/dictionary-entries/Kontragenty/entries' },
}

describe('sortAllowedTypes', () => {
  it('сортирует по position, не мутируя вход', () => {
    const input = [orgs, contractors]
    const sorted = sortAllowedTypes(input)
    expect(sorted.map((t) => t.targetTypeCode)).toEqual(['Kontragenty', 'Organizacii'])
    expect(input.map((t) => t.targetTypeCode)).toEqual(['Organizacii', 'Kontragenty'])
  })
})

describe('findAllowedType', () => {
  it('находит член по targetTypeCode', () => {
    expect(findAllowedType([contractors, orgs], 'Organizacii')).toBe(orgs)
  })
  it('undefined при отсутствии кода или члена', () => {
    expect(findAllowedType([contractors], undefined)).toBeUndefined()
    expect(findAllowedType([contractors], 'Neizvestnyj')).toBeUndefined()
  })
})

describe('resolveSelectedTypeCode', () => {
  const types = [contractors, orgs] // уже отсортированы: Kontragenty первый

  it('приоритет 1: targetTypeCode из значения (round-trip, различает same-domain членов)', () => {
    const value = { id: 5, presentation: 'ТОО Ромашка', targetTypeCode: 'Organizacii' }
    expect(resolveSelectedTypeCode(types, value, 'Kontragenty')).toBe('Organizacii')
  })

  it('targetTypeCode значения не входит в allowedTypes → игнорируется', () => {
    const value = { id: 5, presentation: 'X', targetTypeCode: 'Neizvestnyj' }
    expect(resolveSelectedTypeCode(types, value, undefined)).toBe('Kontragenty')
  })

  it('приоритет 2: ручной выбор пользователя при пустом значении', () => {
    expect(resolveSelectedTypeCode(types, null, 'Organizacii')).toBe('Organizacii')
  })

  it('приоритет 3: первый член по position', () => {
    expect(resolveSelectedTypeCode(types, null, undefined)).toBe('Kontragenty')
  })

  it('пустой allowedTypes → undefined', () => {
    expect(resolveSelectedTypeCode([], null, undefined)).toBeUndefined()
  })
})

describe('buildObjectValue', () => {
  it('пишет type = domainKind члена и targetTypeCode члена (исходящий контракт §2.5)', () => {
    const v = buildObjectValue(orgs, { id: '7', label: 'ТОО Ромашка' })
    expect(v).toEqual({
      id: 7,
      presentation: 'ТОО Ромашка',
      type: 'DICTIONARY',
      targetTypeCode: 'Organizacii',
    })
  })
})
