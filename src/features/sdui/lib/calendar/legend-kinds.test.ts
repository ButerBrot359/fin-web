import { describe, expect, it } from 'vitest'

import type { CalendarDayKind } from './calendar-types'
import { filterLegendKinds } from './legend-kinds'

// SCRUM-277 v13/v15 §3: «Суббота»/«Воскресенье» — только при наличии в году;
// остальные пять видов — всегда, даже при нуле дней (§4.1).
const SEVEN_KINDS: CalendarDayKind[] = [
  { code: 'Rabochiy', title: 'Рабочий' },
  { code: 'Subbota', title: 'Суббота' },
  { code: 'Voskresene', title: 'Воскресенье' },
  { code: 'DopolnitelnyyVykhodnoy', title: 'Дополнительный выходной' },
  { code: 'Predprazdnichnyy', title: 'Предпраздничный' },
  { code: 'Prazdnik', title: 'Праздник' },
  { code: 'Nerabochiy', title: 'Нерабочий' },
]

const codes = (kinds: CalendarDayKind[]) => kinds.map((k) => k.code)

describe('filterLegendKinds (SCRUM-277 v15 §3.1)', () => {
  it('пятидневка: оба weekend-вида в году → все семь чипов', () => {
    const days = [
      { kind: 'Rabochiy' },
      { kind: 'Subbota' },
      { kind: 'Voskresene' },
    ]
    expect(codes(filterLegendKinds(SEVEN_KINDS, days))).toEqual(
      codes(SEVEN_KINDS)
    )
  })

  it('шестидневка: суббот в году нет → чипа «Суббота» нет, «Воскресенье» есть', () => {
    const days = [{ kind: 'Rabochiy' }, { kind: 'Voskresene' }]
    const result = codes(filterLegendKinds(SEVEN_KINDS, days))
    expect(result).not.toContain('Subbota')
    expect(result).toContain('Voskresene')
  })

  it('свежезаполненный год (§4.1): четыре вида с нулём дней ОСТАЮТСЯ в легенде', () => {
    // Rabochiy 261, Subbota 52, Voskresene 52, остальные — 0
    const days = [
      { kind: 'Rabochiy' },
      { kind: 'Subbota' },
      { kind: 'Voskresene' },
    ]
    const result = codes(filterLegendKinds(SEVEN_KINDS, days))
    expect(result).toContain('Prazdnik')
    expect(result).toContain('Predprazdnichnyy')
    expect(result).toContain('DopolnitelnyyVykhodnoy')
    expect(result).toContain('Nerabochiy')
  })

  it('незаполненный год (kind: null у всех) → оба weekend-чипа скрыты, пять остальных на месте', () => {
    const days = [{ kind: null }, { kind: null }]
    const result = codes(filterLegendKinds(SEVEN_KINDS, days))
    expect(result).toEqual([
      'Rabochiy',
      'DopolnitelnyyVykhodnoy',
      'Predprazdnichnyy',
      'Prazdnik',
      'Nerabochiy',
    ])
  })

  it('days undefined (год ещё не пришёл) → фильтруемые скрыты, исходный массив не мутирован', () => {
    const input = [...SEVEN_KINDS]
    const result = filterLegendKinds(input, undefined)
    expect(codes(result)).not.toContain('Subbota')
    expect(input).toHaveLength(7)
  })

  it('новый вид из будущего перечисления 1С НЕ попадает под фильтр (явное множество)', () => {
    const withNew = [...SEVEN_KINDS, { code: 'NovyyVid', title: 'Новый' }]
    const result = codes(filterLegendKinds(withNew, [{ kind: 'Rabochiy' }]))
    expect(result).toContain('NovyyVid')
  })
})
