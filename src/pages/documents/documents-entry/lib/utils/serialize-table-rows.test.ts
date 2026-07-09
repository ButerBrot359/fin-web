import { describe, expect, it } from 'vitest'

import type { DocumentAttribute } from '@/entities/document-type'

import { serializeTableRows } from './serialize-table-rows'

const tableAttr = {
  code: 'Uslugi',
  dataType: 'TABLE',
} as DocumentAttribute

describe('serializeTableRows', () => {
  it('сворачивает ссылочные значения ячеек в id, а OBJECT с _typeCode — в {type, id}', () => {
    const result = serializeTableRows(
      {
        Uslugi: [
          {
            _rhfId: 'abc',
            Nomenklatura: { id: 1, presentation: 'Услуга' },
            UslugiSubkonto1: { id: 42, _typeCode: 'ObektyStroitelstva' },
            Summa: 100,
          },
        ],
      },
      [tableAttr]
    )

    expect(result.Uslugi).toEqual([
      {
        Nomenklatura: 1,
        UslugiSubkonto1: { type: 'ObektyStroitelstva', id: 42 },
        Summa: 100,
      },
    ])
  })

  it('не отправляет служебный ключ __subkontoAllowedTypes на сервер', () => {
    const result = serializeTableRows(
      {
        Uslugi: [
          {
            SchetUcheta: { id: 777, presentation: '2411' },
            UslugiSubkonto1: null,
            __subkontoAllowedTypes: {
              UslugiSubkonto1: [
                {
                  position: 1,
                  domainKind: 'DICTIONARY',
                  targetTypeCode: 'ObektyStroitelstva',
                  presentation: 'Объекты строительства',
                },
              ],
            },
          },
        ],
      },
      [tableAttr]
    )

    const row = (result.Uslugi as Record<string, unknown>[])[0]
    expect('__subkontoAllowedTypes' in row).toBe(false)
    expect(row).toEqual({ SchetUcheta: 777, UslugiSubkonto1: null })
  })
})
