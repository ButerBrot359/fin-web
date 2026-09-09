import { describe, expect, it } from 'vitest'

import {
  WEEKEND_LEGEND_CODE,
  collapseWeekendKinds,
} from './collapse-weekend-kinds'
import { dayKindClass } from './day-kind-palette'

const FULL_SET = [
  { code: 'Rabochiy', title: 'Рабочий' },
  { code: 'Subbota', title: 'Суббота' },
  { code: 'Voskresene', title: 'Воскресенье' },
  { code: 'DopolnitelnyyVykhodnoy', title: 'Дополнительный выходной' },
  { code: 'Predprazdnichnyy', title: 'Предпраздничный' },
  { code: 'Prazdnik', title: 'Праздник' },
  { code: 'Nerabochiy', title: 'Нерабочий' },
]

describe('collapseWeekendKinds (v12 §3)', () => {
  it('сливает Субботу и Воскресенье в один чип «Выходной» на позиции субботы', () => {
    const legend = collapseWeekendKinds(FULL_SET, 'Выходной')
    expect(legend.map((k) => k.code)).toEqual([
      'Rabochiy',
      WEEKEND_LEGEND_CODE,
      'DopolnitelnyyVykhodnoy',
      'Predprazdnichnyy',
      'Prazdnik',
      'Nerabochiy',
    ])
    expect(legend[1].title).toBe('Выходной')
  })

  it('не мутирует исходный массив — меню сохраняет семь видов', () => {
    const legend = collapseWeekendKinds(FULL_SET, 'Выходной')
    expect(legend).toHaveLength(6)
    expect(FULL_SET).toHaveLength(7)
  })

  it('набор без выходных видов возвращается как есть', () => {
    const kinds = [{ code: 'Rabochiy', title: 'Рабочий' }]
    expect(collapseWeekendKinds(kinds, 'Выходной')).toEqual(kinds)
  })

  it('Суббота, Воскресенье и чип «Выходной» красятся одним цветом', () => {
    const saturday = dayKindClass(FULL_SET, 'Subbota')
    expect(dayKindClass(FULL_SET, 'Voskresene')).toBe(saturday)
    expect(dayKindClass(FULL_SET, WEEKEND_LEGEND_CODE)).toBe(saturday)
  })

  it('остальные виды сохраняют свои цвета — не совпадают с выходным', () => {
    const saturday = dayKindClass(FULL_SET, 'Subbota')
    for (const code of [
      'Rabochiy',
      'DopolnitelnyyVykhodnoy',
      'Predprazdnichnyy',
      'Prazdnik',
      'Nerabochiy',
    ]) {
      expect(dayKindClass(FULL_SET, code)).not.toBe(saturday)
    }
  })
})
