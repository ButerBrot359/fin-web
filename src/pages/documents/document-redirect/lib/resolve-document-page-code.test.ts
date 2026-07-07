import { describe, expect, it } from 'vitest'

import { ModuleElementType, type ModuleItems } from '@/entities/module'

import {
  moduleContainsType,
  resolveDocumentPageCode,
} from './resolve-document-page-code'

const items = (...codes: string[]): ModuleItems => [
  // одна колонка с одной секцией
  [
    {
      nameRu: 'Секция',
      nameKz: 'Бөлім',
      elements: codes.map((code) => ({
        code,
        type: ModuleElementType.Document,
        domainKind: 'DOCUMENT',
        nameRu: code,
        nameKz: code,
      })),
    },
  ],
]

describe('moduleContainsType', () => {
  it('находит тип во вложенной структуре колонки → секции → элементы', () => {
    expect(moduleContainsType(items('SchetNaOplatu'), 'SchetNaOplatu')).toBe(true)
  })
  it('false, если типа нет', () => {
    expect(moduleContainsType(items('Drugoe'), 'SchetNaOplatu')).toBe(false)
  })
})

describe('resolveDocumentPageCode', () => {
  it('возвращает первый модуль (в порядке сайдбара), содержащий тип', () => {
    const byCode = {
      buh: items('Drugoe'),
      sales: items('SchetNaOplatu'),
      zup: items('SchetNaOplatu'),
    }
    expect(resolveDocumentPageCode(['buh', 'sales', 'zup'], byCode, 'SchetNaOplatu')).toBe('sales')
  })

  it('undefined, если тип не найден ни в одном модуле', () => {
    expect(resolveDocumentPageCode(['buh'], { buh: items('Drugoe') }, 'Net')).toBeUndefined()
  })

  it('модуль без загруженных items пропускается', () => {
    const byCode = { buh: undefined, sales: items('SchetNaOplatu') }
    expect(resolveDocumentPageCode(['buh', 'sales'], byCode, 'SchetNaOplatu')).toBe('sales')
  })
})
