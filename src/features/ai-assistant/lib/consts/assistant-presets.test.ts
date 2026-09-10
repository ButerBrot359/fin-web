import { describe, expect, it } from 'vitest'

import type { AiAssistantContext } from '@/entities/ai-assistant'

import { selectPresets } from './assistant-presets'

const ids = (
  context: AiAssistantContext,
  capabilities: Parameters<typeof selectPresets>[1]
): string[] => selectPresets(context, capabilities).map((preset) => preset.id)

/**
 * Отбор заготовок.
 *
 * Проверяется не список формулировок — он меняется, — а три правила, из-за которых
 * заготовка либо помогает, либо гарантированно приводит к отказу: положение, наличие
 * сохранённой записи и разрешение организации.
 */
describe('selectPresets', () => {
  it('над открытым документом предлагает вопросы о нём самом', () => {
    expect(
      ids({ kind: 'DOCUMENT', typeCode: 'OperatsiyaBukh', entryId: 42 }, [
        'SEARCH_DATA',
      ])
    ).toEqual(['explain-total', 'check-document', 'compare-period'])
  })

  it('копия предлагается только там, где есть что копировать и чем', () => {
    const opened: AiAssistantContext = {
      kind: 'DOCUMENT',
      typeCode: 'Tabel',
      entryId: 27858509,
    }

    expect(ids(opened, ['SEARCH_DATA', 'CREATE_DOCUMENT'])).toContain(
      'copy-document'
    )
    expect(ids(opened, ['SEARCH_DATA'])).not.toContain('copy-document')
    expect(ids({ kind: 'NONE' }, ['CREATE_DOCUMENT'])).not.toContain(
      'copy-document'
    )
  })

  it('документ без записи — это список: объяснять итог там нечему', () => {
    const list = ids(
      { kind: 'DOCUMENT', typeCode: 'OperatsiyaBukh', entryId: null },
      ['SEARCH_DATA']
    )

    expect(list).not.toContain('explain-total')
    expect(list).toContain('month-documents')
  })

  it('без разрешения на создание заготовка про создание не показывается', () => {
    const context: AiAssistantContext = {
      kind: 'DOCUMENT_NEW',
      typeCode: 'OperatsiyaBukh',
    }

    expect(ids(context, ['SEARCH_DATA'])).not.toContain('copy-last-month')
    expect(ids(context, ['SEARCH_DATA', 'CREATE_DOCUMENT'])).toContain(
      'copy-last-month'
    )
  })

  it('без открытого объекта заготовки всё равно есть', () => {
    // Раньше панель без документа встречала пустым полем: спросить было можно,
    // но не было видно, о чём.
    expect(ids({ kind: 'NONE' }, ['SEARCH_DATA', 'QUERY_TOTALS'])).toEqual([
      'balances',
      'turnovers',
      'unposted-all',
    ])
  })

  it('пока настройки не приехали, предлагается только чтение', () => {
    expect(
      ids({ kind: 'DOCUMENT_LIST', typeCode: 'OperatsiyaBukh' }, null)
    ).toEqual(['month-documents', 'unposted-of-type', 'required-fields'])
  })

  it('в панель влезает не больше четырёх', () => {
    expect(
      ids({ kind: 'DOCUMENT_LIST', typeCode: 'OperatsiyaBukh' }, [
        'SEARCH_DATA',
        'QUERY_TOTALS',
        'CREATE_DOCUMENT',
      ]).length
    ).toBeLessThanOrEqual(4)
  })
})
