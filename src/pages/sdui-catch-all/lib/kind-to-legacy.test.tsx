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

// Таблица 12 списковых kind для полноты карты (SCRUM-360 этап A)
const LIST_KINDS: [string, string][] = [
  ['DOCUMENT_LIST', '/modules/:pageCode/document/:moduleCode'],
  [
    'DOCUMENT_MOVEMENTS',
    '/modules/:pageCode/document/:moduleCode/:entryId/movements',
  ],
  ['DICTIONARY_LIST', '/modules/:pageCode/dictionary/:moduleCode'],
  ['REGISTER', '/modules/:pageCode/informationregister/:moduleCode'],
  // SCRUM-45: бэк развёл вид списка и карточки регистра сведений
  ['REGISTER_LIST', '/modules/:pageCode/informationregister/:moduleCode'],
  [
    'ACCUMULATION_REGISTER',
    '/modules/:pageCode/accumulationregister/:moduleCode',
  ],
  ['ACCOUNTING_REGISTER', '/modules/:pageCode/accountingregister/:moduleCode'],
  ['ACCOUNT_PLAN', '/modules/:pageCode/accountplan/:moduleCode'],
  ['ACCOUNTING_REPORT', '/modules/:pageCode/accountingreport/:moduleCode'],
  ['REPORT', '/modules/:pageCode/report/:moduleCode'],
  ['REPORT_ALT', '/modules/:pageCode/reportalt/:moduleCode'],
  ['DATA_PROCESSOR', '/modules/:pageCode/dataprocessor/:moduleCode'],
  ['CALCULATION_PLAN', '/modules/:pageCode/calculationplan/:moduleCode'],
]

describe('полнота списковых kind (SCRUM-360 этап A)', () => {
  it.each(LIST_KINDS)('%s → %s c элементом', (kind, path) => {
    const e = resolveLegacyEntry(kind)
    expect(e?.path).toBe(path)
    expect(e?.element).toBeTruthy()
  })
})
