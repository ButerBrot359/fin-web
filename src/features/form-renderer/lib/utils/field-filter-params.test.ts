import { describe, it, expect } from 'vitest'

import {
  selectionModeToSearchParams,
  mergeSearchParams,
  fieldFilterToSearchParams,
} from './field-filter-params'

describe('fieldFilterToSearchParams', () => {
  it('attributeEquals с двумя ENUMS-условиями → af с обоими id как есть', () => {
    // Кейс пикера «Движение ОС» документа ВНА: id из дескриптора без перемапа.
    expect(
      fieldFilterToSearchParams({
        attributeEquals: { VidDvizheniya: 1226, ObektDvizheniya: 1141 },
      })
    ).toEqual({ af: 'VidDvizheniya:1226,ObektDvizheniya:1141' })
  })

  it('одно условие → одиночный af', () => {
    expect(
      fieldFilterToSearchParams({ attributeEquals: { Organizatsiya: 30294 } })
    ).toEqual({ af: 'Organizatsiya:30294' })
  })

  it('нет attributeEquals / пусто / нет фильтра → undefined (без af)', () => {
    expect(fieldFilterToSearchParams(undefined)).toBeUndefined()
    expect(fieldFilterToSearchParams({})).toBeUndefined()
    expect(
      fieldFilterToSearchParams({ attributeEquals: {} })
    ).toBeUndefined()
  })

  it('af сохраняется вместе со строкой поиска при слиянии', () => {
    const af = fieldFilterToSearchParams({
      attributeEquals: { VidDvizheniya: 1226 },
    })
    expect(mergeSearchParams(af, { q: 'Лом' })).toEqual({
      af: 'VidDvizheniya:1226',
      q: 'Лом',
    })
  })
})

describe('комбо fieldFilters(af=) + rowFilter(parent=) в одном запросе (§C.2)', () => {
  it('af= и parent= сосуществуют через цепочку merge (как в DictCell)', () => {
    // DictCell: merge(merge(merge(serverFilterParams, depParams), rowParams), parentParams)
    const serverFilterParams = fieldFilterToSearchParams({
      attributeEquals: { VidDvizheniya: 1226 },
    })
    const parentParams = { parent: '55' }
    const merged = mergeSearchParams(
      mergeSearchParams(mergeSearchParams(serverFilterParams, undefined), undefined),
      parentParams
    )
    expect(merged).toEqual({ af: 'VidDvizheniya:1226', parent: '55' })
  })

  it('колонка только с rowFilter → parent= без af=', () => {
    expect(mergeSearchParams(undefined, { parent: '55' })).toEqual({
      parent: '55',
    })
  })

  it('колонка без фильтров → пусто (ни af=, ни parent=)', () => {
    expect(
      mergeSearchParams(mergeSearchParams(undefined, undefined), undefined)
    ).toBeUndefined()
  })
})

describe('selectionModeToSearchParams', () => {
  it('GROUP → { groupsOnly: "true" }', () => {
    expect(selectionModeToSearchParams('GROUP')).toEqual({
      groupsOnly: 'true',
    })
  })

  it('другие режимы и отсутствие значения → undefined (без отбора)', () => {
    expect(selectionModeToSearchParams('GROUP_AND_ELEMENT')).toBeUndefined()
    expect(selectionModeToSearchParams('ELEMENT')).toBeUndefined()
    expect(selectionModeToSearchParams(null)).toBeUndefined()
    expect(selectionModeToSearchParams(undefined)).toBeUndefined()
  })

  it('groupsOnly объединяется с af-фильтром через mergeSearchParams', () => {
    expect(
      mergeSearchParams(
        { af: 'Organizatsiya:30294' },
        selectionModeToSearchParams('GROUP')
      )
    ).toEqual({ af: 'Organizatsiya:30294', groupsOnly: 'true' })
  })
})
