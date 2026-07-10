import { describe, expect, it } from 'vitest'

import type { ConditionalAppearance } from '@/entities/form-config'

import {
  evaluateAppearance,
  findColumnAppearanceRules,
} from './conditional-appearance'

const appearance: ConditionalAppearance[] = [
  {
    tableParts: ['OsnovnyeSredstva', 'NematerialnyeAktivy'],
    column: 'IzlishkiNedostachaKolichestvo',
    rules: [
      {
        when: {
          attribute: 'IzlishkiNedostachaKolichestvo',
          operator: 'less',
          value: 0,
        },
        text: 'Недостача',
        textColor: 'red',
      },
      {
        when: {
          attribute: 'IzlishkiNedostachaKolichestvo',
          operator: 'greater',
          value: 0,
        },
        text: 'Излишки',
        textColor: 'green',
      },
    ],
  },
]

describe('findColumnAppearanceRules', () => {
  it('находит правила по ТЧ и колонке', () => {
    expect(
      findColumnAppearanceRules(
        appearance,
        'NematerialnyeAktivy',
        'IzlishkiNedostachaKolichestvo'
      )
    ).toHaveLength(2)
  })

  it('нет совпадения ТЧ/колонки → undefined', () => {
    expect(
      findColumnAppearanceRules(appearance, 'Uslugi', 'Summa')
    ).toBeUndefined()
    expect(
      findColumnAppearanceRules(appearance, 'OsnovnyeSredstva', 'DrugayaKolonka')
    ).toBeUndefined()
  })
})

describe('evaluateAppearance', () => {
  const rules = appearance[0].rules

  it('значение < 0 → «Недостача» красным', () => {
    expect(evaluateAppearance(rules, -1)).toEqual({
      text: 'Недостача',
      color: 'red',
    })
  })

  it('значение > 0 → «Излишки» зелёным', () => {
    expect(evaluateAppearance(rules, 1)).toEqual({
      text: 'Излишки',
      color: 'green',
    })
  })

  it('значение = 0 → null (обычное число)', () => {
    expect(evaluateAppearance(rules, 0)).toBeNull()
  })

  it('строковое числовое значение тоже сравнивается', () => {
    expect(evaluateAppearance(rules, '-1')?.text).toBe('Недостача')
  })

  it('нет правил / нечисловое значение → null', () => {
    expect(evaluateAppearance(undefined, -1)).toBeNull()
    expect(evaluateAppearance(rules, 'abc')).toBeNull()
  })
})
