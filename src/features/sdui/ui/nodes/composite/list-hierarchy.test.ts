import { describe, it, expect } from 'vitest'

import {
  buildLevelParams,
  isGroupRow,
  isGroupsOnlySource,
  resolveRowLabel,
  supportsHierarchy,
} from './list-hierarchy'

const PAGED_URL =
  '/api/universaldomain-entries/DICTIONARY/KlassifikatsiyaDolzhnosteyPoFunktsionalnymBlokam/paged'

describe('supportsHierarchy', () => {
  it('справочник на /paged — уровни поддержаны', () => {
    expect(supportsHierarchy({ url: PAGED_URL })).toBe(true)
  })

  it('другой домен — parent там не поддержан, навигации нет', () => {
    expect(
      supportsHierarchy({
        url: '/api/universaldomain-entries/ACCOUNT_PLAN/Hozraschet/paged',
      })
    ).toBe(false)
    expect(
      supportsHierarchy({
        url: '/api/universaldomain-entries/DOCUMENT/PriemNaRabotu/paged',
      })
    ).toBe(false)
  })

  it('не /paged эндпоинт', () => {
    expect(
      supportsHierarchy({
        url: '/api/universaldomain-entries/DICTIONARY/Valyuty/search',
      })
    ).toBe(false)
  })

  it('панель выбора папки (groupsOnly) — папки выбираются, внутрь не проваливаемся', () => {
    expect(
      supportsHierarchy({ url: PAGED_URL, params: { groupsOnly: 'true' } })
    ).toBe(false)
  })

  it('без источника', () => {
    expect(supportsHierarchy(undefined)).toBe(false)
  })
})

describe('isGroupsOnlySource', () => {
  it('распознаёт панель выбора папки', () => {
    expect(
      isGroupsOnlySource({ url: PAGED_URL, params: { groupsOnly: 'true' } })
    ).toBe(true)
    expect(isGroupsOnlySource({ url: PAGED_URL })).toBe(false)
  })
})

describe('buildLevelParams', () => {
  it('корневой уровень — без parent', () => {
    expect(buildLevelParams(undefined, undefined)).toEqual({})
  })

  it('уровень папки запрашивается по parent', () => {
    expect(buildLevelParams(undefined, 28485)).toEqual({ parent: '28485' })
  })

  it('вырезает flatWithGroups — иначе вместо уровня придёт весь справочник', () => {
    expect(
      buildLevelParams({ flatWithGroups: 'true', af: 'X:1' }, undefined)
    ).toEqual({ af: 'X:1' })
  })

  it('серверный parent не перебивает уровень навигации', () => {
    expect(buildLevelParams({ parent: '999' }, 28485)).toEqual({
      parent: '28485',
    })
  })

  it('прочие отборы поля сохраняются', () => {
    expect(
      buildLevelParams({ af: 'Organizatsiya:30294', entryIds: '1,2' }, 5)
    ).toEqual({ af: 'Organizatsiya:30294', entryIds: '1,2', parent: '5' })
  })
})

describe('isGroupRow', () => {
  it('папка только при isGroup === true', () => {
    expect(isGroupRow({ id: 1, isGroup: true })).toBe(true)
    expect(isGroupRow({ id: 1, isGroup: false })).toBe(false)
    expect(isGroupRow({ id: 1 })).toBe(false)
  })
})

describe('resolveRowLabel', () => {
  it('берёт presentation, затем наименование, затем код', () => {
    expect(
      resolveRowLabel({ id: 1, presentation: 'Блок B', nameRu: 'X' })
    ).toBe('Блок B')
    expect(resolveRowLabel({ id: 1, nameRu: 'Здравоохранение' })).toBe(
      'Здравоохранение'
    )
    expect(resolveRowLabel({ id: 1, code: '0042' })).toBe('0042')
  })

  it('пустые строки пропускает, в крайнем случае — id', () => {
    expect(resolveRowLabel({ id: 7, presentation: '  ', nameRu: '' })).toBe('7')
  })
})
