import { describe, it, expect } from 'vitest'

import { headerFieldPath, tableColumnPath, isFieldVisible } from './field-path'

describe('field-path', () => {
  it('headerFieldPath — путь поля шапки равен коду реквизита', () => {
    expect(headerFieldPath('DvizhenieFinanisrovaniya')).toBe(
      'DvizhenieFinanisrovaniya'
    )
  })

  it('tableColumnPath — конкатенация <КодТЧ><КодКолонки> без разделителя', () => {
    expect(tableColumnPath('PlanFinansirovaniya', 'KodPlatnykhUslug')).toBe(
      'PlanFinansirovaniyaKodPlatnykhUslug'
    )
  })
})

describe('isFieldVisible', () => {
  it('отсутствие ключа → видим (fallback на статический showInForm)', () => {
    expect(isFieldVisible({}, 'TekstOsnovaniya')).toBe(true)
    expect(isFieldVisible({ Other: false }, 'TekstOsnovaniya')).toBe(true)
  })

  it('false → скрыт, true → видим', () => {
    expect(isFieldVisible({ TekstOsnovaniya: false }, 'TekstOsnovaniya')).toBe(
      false
    )
    expect(isFieldVisible({ TekstOsnovaniya: true }, 'TekstOsnovaniya')).toBe(
      true
    )
  })

  it('фильтрация колонок ТЧ по visibility (сценарий «только Специфика»)', () => {
    const visibilityMap: Record<string, boolean> = {
      PlanFinansirovaniyaFKR: false,
      PlanFinansirovaniyaKodPlatnykhUslug: false,
      PlanFinansirovaniyaSpetsifika: true,
    }
    const columns = [
      { code: 'FKR' },
      { code: 'KodPlatnykhUslug' },
      { code: 'Spetsifika' },
      { code: 'Summa' }, // ключа нет → видима
    ]

    const visible = columns.filter((col) =>
      isFieldVisible(
        visibilityMap,
        tableColumnPath('PlanFinansirovaniya', col.code)
      )
    )

    expect(visible.map((c) => c.code)).toEqual(['Spetsifika', 'Summa'])
  })
})
