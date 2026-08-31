import { describe, expect, it } from 'vitest'
import { resolveLegacyRoutes } from './kind-to-legacy'

describe('resolveLegacyRoutes', () => {
  it('DOCUMENT_LIST → module-путь + плоский путь списка документов', () => {
    const routes = resolveLegacyRoutes('DOCUMENT_LIST')
    expect(routes?.map((r) => r.path)).toEqual([
      '/modules/:pageCode/document/:moduleCode',
      '/documents/:typeCode',
    ])
  })
  it('DOCUMENT_MOVEMENTS → паттерн движений', () => {
    expect(
      resolveLegacyRoutes('DOCUMENT_MOVEMENTS')?.map((r) => r.path)
    ).toEqual(['/modules/:pageCode/document/:moduleCode/:entryId/movements'])
  })
  it('неизвестный kind → null', () => {
    expect(resolveLegacyRoutes('WAT')).toBeNull()
  })
})

// Таблица списковых kind для полноты карты (SCRUM-360 этап A)
const LIST_KINDS: [string, string[]][] = [
  [
    'DOCUMENT_LIST',
    ['/modules/:pageCode/document/:moduleCode', '/documents/:typeCode'],
  ],
  [
    'DOCUMENT_MOVEMENTS',
    ['/modules/:pageCode/document/:moduleCode/:entryId/movements'],
  ],
  [
    'DICTIONARY_LIST',
    ['/modules/:pageCode/dictionary/:moduleCode', '/dictionaries/:typeCode'],
  ],
  ['REGISTER', ['/modules/:pageCode/informationregister/:moduleCode']],
  // SCRUM-45: бэк развёл вид списка и карточки регистра сведений
  ['REGISTER_LIST', ['/modules/:pageCode/informationregister/:moduleCode']],
  [
    'ACCUMULATION_REGISTER',
    ['/modules/:pageCode/accumulationregister/:moduleCode'],
  ],
  [
    'ACCOUNTING_REGISTER',
    ['/modules/:pageCode/accountingregister/:moduleCode'],
  ],
  ['ACCOUNT_PLAN', ['/modules/:pageCode/accountplan/:moduleCode']],
  ['ACCOUNTING_REPORT', ['/modules/:pageCode/accountingreport/:moduleCode']],
  ['REPORT', ['/modules/:pageCode/report/:moduleCode']],
  ['REPORT_ALT', ['/modules/:pageCode/reportalt/:moduleCode']],
  ['DATA_PROCESSOR', ['/modules/:pageCode/dataprocessor/:moduleCode']],
  ['CALCULATION_PLAN', ['/modules/:pageCode/calculationplan/:moduleCode']],
]

describe('полнота списковых kind (SCRUM-360 этап A)', () => {
  it.each(LIST_KINDS)('%s → %s c элементами', (kind, paths) => {
    const routes = resolveLegacyRoutes(kind)
    expect(routes?.map((r) => r.path)).toEqual(paths)
  })
})

// Карточные kind (SCRUM-360 этап B): module-путь на легаси-страницу +
// плоский путь на редирект (кроме DICTIONARY_NEW — у dictionary-redirect
// нет режима 'new').
const CARD_KINDS: [string, string[]][] = [
  [
    'DOCUMENT',
    [
      '/modules/:pageCode/document/:moduleCode/:entryId',
      '/documents/:typeCode/:entryId',
    ],
  ],
  [
    'DOCUMENT_NEW',
    ['/modules/:pageCode/document/:moduleCode/new', '/documents/:typeCode/new'],
  ],
  [
    'DICTIONARY',
    [
      '/modules/:pageCode/dictionary/:moduleCode/:entryId',
      '/dictionaries/:typeCode/:entryId',
    ],
  ],
  ['DICTIONARY_NEW', ['/modules/:pageCode/dictionary/:moduleCode/new']],
]

describe('полнота карточных kind (SCRUM-360 этап B)', () => {
  it.each(CARD_KINDS)('%s → %s c элементами', (kind, paths) => {
    const routes = resolveLegacyRoutes(kind)
    expect(routes?.map((r) => r.path)).toEqual(paths)
  })
})
