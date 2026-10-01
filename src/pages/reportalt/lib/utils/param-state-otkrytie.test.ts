import { describe, expect, it } from 'vitest'

import { primenimyePriOtkrytii } from './params'

describe('Значения состояния формы при открытии', () => {
  it('применяются только к параметрам, оставшимся со значением по умолчанию', () => {
    expect(
      primenimyePriOtkrytii(
        { NeIspolzovatStrukturnyePodrazdeleniya: false, Organizatsiya: 5 },
        new Set(['NeIspolzovatStrukturnyePodrazdeleniya'])
      )
    ).toEqual({ NeIspolzovatStrukturnyePodrazdeleniya: false })
  })

  it('значение из адреса или черновика не перетирается', () => {
    expect(
      primenimyePriOtkrytii(
        { NeIspolzovatStrukturnyePodrazdeleniya: false },
        new Set<string>()
      )
    ).toEqual({})
  })
})
