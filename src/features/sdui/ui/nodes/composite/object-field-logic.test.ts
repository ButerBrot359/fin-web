import { describe, expect, it } from 'vitest'

import {
  sortAllowedTypes,
  findAllowedType,
  resolveSelectedTypeCode,
  buildObjectValue,
  memberKey,
  findMemberByKey,
  resolveSelectedMemberKey,
  membersSignature,
  isValueAllowed,
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
    expect(sorted.map((t) => t.targetTypeCode)).toEqual([
      'Kontragenty',
      'Organizacii',
    ])
    expect(input.map((t) => t.targetTypeCode)).toEqual([
      'Organizacii',
      'Kontragenty',
    ])
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
    const value = {
      id: 5,
      presentation: 'ТОО Ромашка',
      targetTypeCode: 'Organizacii',
    }
    expect(resolveSelectedTypeCode(types, value, 'Kontragenty')).toBe(
      'Organizacii'
    )
  })

  it('targetTypeCode значения не входит в allowedTypes → игнорируется', () => {
    const value = { id: 5, presentation: 'X', targetTypeCode: 'Neizvestnyj' }
    expect(resolveSelectedTypeCode(types, value, undefined)).toBe('Kontragenty')
  })

  it('приоритет 2: ручной выбор пользователя при пустом значении', () => {
    expect(resolveSelectedTypeCode(types, null, 'Organizacii')).toBe(
      'Organizacii'
    )
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

// ── Примитивные члены составного типа: SCRUM-279 ──
// Фикстура — НЕ выдумана: это ровно те 7 членов, которые бэк отдаёт для колонки
// «Значение» табличной части «Дополнительные реквизиты» карточки физлица
// (props.allowedTypes узла dict.field.DopolnitelnyeRekvizity.col.Znachenie,
// снято с localhost:8081 30.07). Четыре члена из семи — примитивы: у них нет ни
// targetTypeCode, ни presentation.
describe('члены без targetTypeCode (примитивы)', () => {
  const dopRekvizityMembers: AllowedType[] = [
    {
      position: 1,
      domainKind: 'DICTIONARY',
      targetTypeCode: 'ZnacheniyaSvoystvObektovIerarkhiya',
      presentation: 'Дополнительные значения (иерархия)',
      optionsSource: {
        url: '/api/dictionary-entries/ZnacheniyaSvoystvObektovIerarkhiya/entries',
      },
    },
    { position: 2, domainKind: 'BOOLEAN' } as AllowedType,
    {
      position: 3,
      domainKind: 'DICTIONARY',
      targetTypeCode: 'ZnacheniyaSvoystvObektov',
      presentation: 'Дополнительные значения',
      optionsSource: {
        url: '/api/dictionary-entries/ZnacheniyaSvoystvObektov/entries',
      },
    },
    { position: 4, domainKind: 'STRING' } as AllowedType,
    { position: 5, domainKind: 'DATETIME' } as AllowedType,
    { position: 6, domainKind: 'DECIMAL' } as AllowedType,
    {
      position: 7,
      domainKind: 'DICTIONARY',
      targetTypeCode: 'Polzovateli',
      presentation: 'Пользователи',
      optionsSource: { url: '/api/dictionary-entries/Polzovateli/entries' },
    },
  ]

  describe('memberKey', () => {
    it('ссылочный член опознаётся по targetTypeCode', () => {
      expect(memberKey(orgs)).toBe('Organizacii')
    })

    it('примитивный член — по domainKind и position', () => {
      expect(memberKey(dopRekvizityMembers[3])).toBe('STRING#4')
    })

    it('ключи ВСЕХ семи членов уникальны — иначе пункты списка неразличимы', () => {
      const keys = dopRekvizityMembers.map(memberKey)
      expect(new Set(keys).size).toBe(7)
    })

    it('два примитива одного домена различаются позицией', () => {
      const a: AllowedType = {
        position: 4,
        domainKind: 'STRING',
      } as AllowedType
      const b: AllowedType = {
        position: 9,
        domainKind: 'STRING',
      } as AllowedType
      expect(memberKey(a)).not.toBe(memberKey(b))
    })
  })

  describe('findMemberByKey', () => {
    it('находит примитивный член по составному ключу', () => {
      expect(findMemberByKey(dopRekvizityMembers, 'DECIMAL#6')).toBe(
        dopRekvizityMembers[5]
      )
    })

    it('находит ссылочный член по targetTypeCode', () => {
      expect(findMemberByKey(dopRekvizityMembers, 'Polzovateli')).toBe(
        dopRekvizityMembers[6]
      )
    })

    it('undefined на пустой ключ и на несуществующий', () => {
      expect(findMemberByKey(dopRekvizityMembers, undefined)).toBeUndefined()
      expect(findMemberByKey(dopRekvizityMembers, 'STRING#99')).toBeUndefined()
    })
  })

  describe('resolveSelectedMemberKey', () => {
    it('приоритет 1: тип из значения важнее ручного выбора', () => {
      const value = {
        id: 5,
        presentation: 'Высшее',
        targetTypeCode: 'ZnacheniyaSvoystvObektov',
      }
      expect(
        resolveSelectedMemberKey(dopRekvizityMembers, value, 'STRING#4')
      ).toBe('ZnacheniyaSvoystvObektov')
    })

    it('приоритет 2: ручной выбор примитивного члена сохраняется (старый резолв по targetTypeCode его терял)', () => {
      expect(
        resolveSelectedMemberKey(dopRekvizityMembers, null, 'STRING#4')
      ).toBe('STRING#4')
      // Контраст: резолв по targetTypeCode на том же вводе откатывался к первому члену
      expect(
        resolveSelectedTypeCode(dopRekvizityMembers, null, 'STRING#4')
      ).toBe('ZnacheniyaSvoystvObektovIerarkhiya')
    })

    it('приоритет 3: первый член по position', () => {
      expect(
        resolveSelectedMemberKey(dopRekvizityMembers, null, undefined)
      ).toBe('ZnacheniyaSvoystvObektovIerarkhiya')
    })

    it('несуществующий ручной ключ игнорируется', () => {
      expect(
        resolveSelectedMemberKey(dopRekvizityMembers, null, 'NETAKOGO#1')
      ).toBe('ZnacheniyaSvoystvObektovIerarkhiya')
    })

    it('пустой allowedTypes → undefined', () => {
      expect(resolveSelectedMemberKey([], null, undefined)).toBeUndefined()
    })
  })
})

describe('membersSignature', () => {
  const kontragenty: AllowedType = {
    position: 1,
    domainKind: 'DICTIONARY',
    targetTypeCode: 'Kontragenty',
  }
  const fizLitsa: AllowedType = {
    position: 2,
    domainKind: 'DICTIONARY',
    targetTypeCode: 'FizicheskieLitsa',
  }

  it('тот же состав в новом массиве — отпечаток совпадает', () => {
    expect(membersSignature([kontragenty, fizLitsa])).toBe(
      membersSignature([{ ...kontragenty }, { ...fizLitsa }])
    )
  })

  it('другой набор членов — отпечаток другой', () => {
    expect(membersSignature([kontragenty, fizLitsa])).not.toBe(
      membersSignature([kontragenty])
    )
  })

  it('примитивные члены различаются позицией, а не кодом', () => {
    const str: AllowedType = { position: 1, domainKind: 'STRING' }
    const bool: AllowedType = { position: 2, domainKind: 'BOOLEAN' }
    expect(membersSignature([str, bool])).not.toBe(membersSignature([str]))
  })
})

describe('isValueAllowed', () => {
  const types: AllowedType[] = [
    { position: 1, domainKind: 'DICTIONARY', targetTypeCode: 'Kontragenty' },
    {
      position: 2,
      domainKind: 'DICTIONARY',
      targetTypeCode: 'FizicheskieLitsa',
    },
  ]

  it('значение своего вида допустимо', () => {
    expect(
      isValueAllowed(types, {
        id: 1,
        presentation: 'ТОО',
        targetTypeCode: 'Kontragenty',
      })
    ).toBe(true)
  })

  it('значение вида, которого больше нет в наборе, недопустимо', () => {
    expect(
      isValueAllowed(types, {
        id: 3346,
        presentation: 'Движение',
        targetTypeCode: 'DvizheniyaFinansirovaniya',
      })
    ).toBe(false)
  })

  it('пустое значение и значение без targetTypeCode не трогаем', () => {
    expect(isValueAllowed(types, null)).toBe(true)
    expect(isValueAllowed(types, { id: 1, presentation: 'Строка' })).toBe(true)
  })
})
