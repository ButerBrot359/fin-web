import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useFormContext } from './use-form-context'

const mockPathname = vi.hoisted(() => ({ value: '/' }))

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: mockPathname.value }),
}))

const contextFor = (pathname: string) => {
  mockPathname.value = pathname
  return renderHook(() => useFormContext()).result.current
}

/**
 * Определение контекста по адресу.
 *
 * Тест написан после живой жалобы «нахожусь внутри документа — пишет, что документ не
 * открыт»: первая версия знала только модульное семейство маршрутов и требовала числовой
 * идентификатор. Оба семейства перечислены в `tab-entity-key.ts`, и расходиться им нельзя.
 */
describe('useFormContext', () => {
  it('модульный маршрут карточки документа', () => {
    expect(
      contextFor('/modules/Kassa/document/RaskhodnyyKassovyyOrder/42')
    ).toEqual({
      kind: 'DOCUMENT',
      typeCode: 'RaskhodnyyKassovyyOrder',
      entryId: 42,
    })
  })

  it('плоский маршрут карточки документа — второе семейство, из-за него и была жалоба', () => {
    expect(contextFor('/documents/RaskhodnyyKassovyyOrder/42')).toEqual({
      kind: 'DOCUMENT',
      typeCode: 'RaskhodnyyKassovyyOrder',
      entryId: 42,
    })
  })

  it('движения документа — это всё ещё тот же документ', () => {
    expect(
      contextFor('/modules/Kassa/document/RaskhodnyyKassovyyOrder/42/movements')
    ).toEqual({
      kind: 'DOCUMENT',
      typeCode: 'RaskhodnyyKassovyyOrder',
      entryId: 42,
    })
  })

  it('список документов — контекст, а не его отсутствие: тип уже известен', () => {
    expect(
      contextFor('/modules/Kassa/document/RaskhodnyyKassovyyOrder')
    ).toEqual({
      kind: 'DOCUMENT_LIST',
      typeCode: 'RaskhodnyyKassovyyOrder',
      entryId: null,
    })
  })

  it('новая карточка: идентификатора нет, но тип известен', () => {
    expect(contextFor('/documents/RaskhodnyyKassovyyOrder/new')).toEqual({
      kind: 'DOCUMENT_NEW',
      typeCode: 'RaskhodnyyKassovyyOrder',
    })
  })

  it('справочники — оба семейства', () => {
    expect(
      contextFor('/modules/Spravochniki/dictionary/Kontragenty/7')
    ).toEqual({
      kind: 'DICTIONARY',
      typeCode: 'Kontragenty',
      entryId: 7,
    })
    expect(contextFor('/dictionaries/Kontragenty')).toEqual({
      kind: 'DICTIONARY_LIST',
      typeCode: 'Kontragenty',
      entryId: null,
    })
  })

  it('посторонние страницы контекста не дают', () => {
    expect(contextFor('/')).toEqual({ kind: 'NONE' })
    expect(contextFor('/modules/Analitika/analytics/settings')).toEqual({
      kind: 'NONE',
    })
  })
})
