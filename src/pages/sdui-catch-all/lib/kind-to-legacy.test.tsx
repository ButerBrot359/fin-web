import { describe, expect, it } from 'vitest'
import { resolveLegacyEntry } from './kind-to-legacy'

describe('resolveLegacyEntry', () => {
  it('DOCUMENT_LIST → паттерн списка документов', () => {
    const e = resolveLegacyEntry('DOCUMENT_LIST')
    expect(e?.path).toBe('/modules/:pageCode/document/:moduleCode')
    expect(e?.element).toBeTruthy()
  })
  it('DOCUMENT_MOVEMENTS → паттерн движений', () => {
    expect(resolveLegacyEntry('DOCUMENT_MOVEMENTS')?.path).toBe(
      '/modules/:pageCode/document/:moduleCode/:entryId/movements'
    )
  })
  it('неизвестный kind → null', () => {
    expect(resolveLegacyEntry('WAT')).toBeNull()
  })
})
