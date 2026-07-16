import { describe, it, expect } from 'vitest'

import {
  hasAttributeIn,
  attributeInIsEmpty,
  attributeInToFilterRequest,
} from './attribute-in-filter'

describe('attributeInToFilterRequest', () => {
  it('attributeIn.id → id IN […] + parentId isNotNull (эталон ВидНМА)', () => {
    const req = attributeInToFilterRequest({
      domain: 'DICTIONARY',
      typeCode: 'VidyDolgosrochnykhAktivov',
      attributeIn: { id: [101, 102, 103, 104, 105] },
    })
    expect(req).toEqual({
      filters: [
        { field: 'id', op: 'in', value: [101, 102, 103, 104, 105] },
        { field: 'parentId', op: 'isNotNull', value: null },
      ],
      logic: 'AND',
    })
  })

  it('все id доходят до запроса без потерь', () => {
    const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const req = attributeInToFilterRequest({ attributeIn: { id: ids } })
    const idCond = req?.filters.find((f) => f.field === 'id')
    expect(idCond?.value).toEqual(ids)
  })

  it('пустой массив → запрос с id IN [] (пикер сам покажет пусто)', () => {
    const req = attributeInToFilterRequest({ attributeIn: { id: [] } })
    expect(req?.filters[0]).toEqual({ field: 'id', op: 'in', value: [] })
    // parentId-условие всё равно есть (escape-hatch на бэке).
    expect(req?.filters).toContainEqual({
      field: 'parentId',
      op: 'isNotNull',
      value: null,
    })
  })

  it('нет attributeIn → undefined', () => {
    expect(attributeInToFilterRequest(undefined)).toBeUndefined()
    expect(attributeInToFilterRequest({ attributeEquals: { X: 1 } })).toBeUndefined()
    expect(attributeInToFilterRequest({ attributeIn: {} })).toBeUndefined()
  })
})

describe('attributeInIsEmpty / hasAttributeIn', () => {
  it('пустой набор (fail-closed) → isEmpty=true, has=true', () => {
    const f = { attributeIn: { id: [] } }
    expect(attributeInIsEmpty(f)).toBe(true)
    expect(hasAttributeIn(f)).toBe(true)
  })

  it('непустой набор → isEmpty=false, has=true', () => {
    const f = { attributeIn: { id: [1] } }
    expect(attributeInIsEmpty(f)).toBe(false)
    expect(hasAttributeIn(f)).toBe(true)
  })

  it('нет attributeIn → has=false, isEmpty=false', () => {
    expect(hasAttributeIn({ attributeEquals: { X: 1 } })).toBe(false)
    expect(attributeInIsEmpty({ attributeEquals: { X: 1 } })).toBe(false)
    expect(hasAttributeIn(undefined)).toBe(false)
  })
})
