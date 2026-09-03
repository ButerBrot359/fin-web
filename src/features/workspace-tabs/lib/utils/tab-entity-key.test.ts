import { describe, expect, it } from 'vitest'

import { tabEntityKey } from './tab-entity-key'

// SCRUM-386 фикс 2: модульный и плоский URL одной сущности дают один ключ.
describe('tabEntityKey', () => {
  it('карточка документа: модульный и плоский пути эквивалентны', () => {
    expect(tabEntityKey('/modules/Administrirovanie/document/Tabel/123')).toBe(
      'document:Tabel:123'
    )
    expect(tabEntityKey('/documents/Tabel/123')).toBe('document:Tabel:123')
  })

  it('создание документа: один ключ на тип', () => {
    expect(tabEntityKey('/modules/ZarplataIKadry/document/Tabel/new')).toBe(
      'document-new:Tabel'
    )
    expect(tabEntityKey('/documents/Tabel/new')).toBe('document-new:Tabel')
  })

  it('список документов и движения различимы', () => {
    expect(tabEntityKey('/documents/Tabel')).toBe('document-list:Tabel')
    expect(tabEntityKey('/modules/M/document/Tabel')).toBe(
      'document-list:Tabel'
    )
    expect(tabEntityKey('/documents/Tabel/123/movements')).toBe(
      'document-movements:Tabel:123'
    )
    expect(tabEntityKey('/modules/M/document/Tabel/123/movements')).toBe(
      'document-movements:Tabel:123'
    )
  })

  it('справочники: карточка/создание/список', () => {
    expect(tabEntityKey('/dictionaries/Kalendari/49237')).toBe(
      'dictionary:Kalendari:49237'
    )
    expect(tabEntityKey('/modules/M/dictionary/Kalendari/49237')).toBe(
      'dictionary:Kalendari:49237'
    )
    expect(tabEntityKey('/dictionaries/Kalendari/new')).toBe(
      'dictionary-new:Kalendari'
    )
    expect(tabEntityKey('/modules/M/dictionary/Kalendari')).toBe(
      'dictionary-list:Kalendari'
    )
  })

  it('прочие маршруты — без ключа', () => {
    expect(tabEntityKey('/modules/Administrirovanie')).toBeNull()
    expect(tabEntityKey('/')).toBeNull()
    expect(tabEntityKey('/account-plan')).toBeNull()
  })
})
