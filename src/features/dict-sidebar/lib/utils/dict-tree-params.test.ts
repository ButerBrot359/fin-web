import { describe, it, expect } from 'vitest'

import {
  buildTreeLevelParams,
  buildSearchParams,
  isGroupsOnlyPanel,
} from './dict-tree-params'

describe('buildTreeLevelParams', () => {
  it('корневой уровень идёт без parent — бэк отдаёт parent IS NULL (папки + записи корня)', () => {
    expect(buildTreeLevelParams(undefined)).toEqual({})
  })

  it('вложенный уровень запрашивается по parent раскрытого узла', () => {
    expect(buildTreeLevelParams(undefined, 28485)).toEqual({ parent: 28485 })
  })

  it('сохраняет серверные отборы поля', () => {
    expect(
      buildTreeLevelParams(
        { af: 'Organizatsiya:30294', entryIds: '1,2' },
        28485
      )
    ).toEqual({ af: 'Organizatsiya:30294', entryIds: '1,2', parent: 28485 })
  })

  it('вырезает flatWithGroups — иначе уровень схлопнулся бы во весь справочник', () => {
    expect(buildTreeLevelParams({ flatWithGroups: 'true', af: 'X:1' })).toEqual(
      {
        af: 'X:1',
      }
    )
  })

  it('вырезает grouped — grouped=false вернул бы одни листья, без папок', () => {
    expect(buildTreeLevelParams({ grouped: 'false' }, 28485)).toEqual({
      parent: 28485,
    })
  })

  it('parent уровня приоритетнее parent из параметров поля', () => {
    expect(buildTreeLevelParams({ parent: '999' }, 28485)).toEqual({
      parent: 28485,
    })
  })
})

describe('buildSearchParams', () => {
  it('убирает parent — parent вместе с поиском бэк отвергает (HTTP 400)', () => {
    expect(buildSearchParams({ parent: '28485', af: 'X:1' })).toEqual({
      af: 'X:1',
    })
  })

  it('остальные отборы поля в поиске сохраняются', () => {
    expect(buildSearchParams({ af: 'X:1', flatWithGroups: 'true' })).toEqual({
      af: 'X:1',
      flatWithGroups: 'true',
    })
  })

  it('без параметров возвращает пустой объект', () => {
    expect(buildSearchParams(undefined)).toEqual({})
  })
})

describe('isGroupsOnlyPanel', () => {
  it('groupsOnly=true → панель выбора папки', () => {
    expect(isGroupsOnlyPanel({ groupsOnly: 'true' })).toBe(true)
  })

  it('обычная панель', () => {
    expect(isGroupsOnlyPanel({ af: 'X:1' })).toBe(false)
    expect(isGroupsOnlyPanel(undefined)).toBe(false)
  })
})
