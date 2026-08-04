import { describe, expect, it } from 'vitest'
import { mapKindToPageType } from './tab-kind'

describe('mapKindToPageType', () => {
  it('MODULE → module', () => {
    expect(mapKindToPageType('MODULE')).toBe('module')
  })
  it('DOCUMENT → document-entry', () => {
    expect(mapKindToPageType('DOCUMENT')).toBe('document-entry')
  })
  it('DOCUMENT_NEW → document-entry', () => {
    expect(mapKindToPageType('DOCUMENT_NEW')).toBe('document-entry')
  })
  it('DICTIONARY → dictionary-entry', () => {
    expect(mapKindToPageType('DICTIONARY')).toBe('dictionary-entry')
  })
  it('DICTIONARY_NEW → dictionary-entry', () => {
    expect(mapKindToPageType('DICTIONARY_NEW')).toBe('dictionary-entry')
  })
  it('немигрированный вид → null', () => {
    expect(mapKindToPageType('DOCUMENT_LIST')).toBeNull()
  })
})
