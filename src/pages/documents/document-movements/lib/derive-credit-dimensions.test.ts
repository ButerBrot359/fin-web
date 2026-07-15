import { describe, it, expect } from 'vitest'

import type { MovementGroup } from '../api/document-movements-api'
import { deriveCreditDimensions } from './derive-credit-dimensions'

const podr = (id: number, name: string) => ({ id, displayName: name })

const accumulation = (entries: Record<string, unknown>[]): MovementGroup => ({
  registerKind: 'ACCUMULATION',
  registerTypeCode: 'DvizheniyaTMZ',
  registerTypeNameRu: 'Движения ТМЗ',
  registerTypeNameKz: '',
  columns: [],
  entries,
})

const accounting: MovementGroup = {
  registerKind: 'ACCOUNTING',
  registerTypeCode: 'ZhurnalProvodokGosUchrezhdeniya',
  registerTypeNameRu: '',
  registerTypeNameKz: '',
  columns: [],
  entries: [{ _movementKind: 'Расход', PodrazdelenieOrganizatsii: podr(9, 'Шум') }],
}

describe('deriveCreditDimensions', () => {
  it('берёт подразделение из «Расхода» накопительного регистра (Перемещение ТМЗ)', () => {
    const groups = [
      accumulation([
        { _movementKind: 'Приход', PodrazdelenieOrganizatsii: podr(262537, 'Даурен') },
        { _movementKind: 'Расход', PodrazdelenieOrganizatsii: podr(262424, 'Лаура') },
      ]),
    ]
    expect(deriveCreditDimensions(groups)).toEqual({
      Podrazdelenie: podr(262424, 'Лаура'),
    })
  })

  it('ACCOUNTING-группы игнорируются (берём только накопительные)', () => {
    expect(deriveCreditDimensions([accounting])).toEqual({})
  })

  it('неоднозначность (несколько разных расходных подразделений) → без подстановки', () => {
    const groups = [
      accumulation([
        { _movementKind: 'Расход', PodrazdelenieOrganizatsii: podr(1, 'A') },
        { _movementKind: 'Расход', PodrazdelenieOrganizatsii: podr(2, 'B') },
      ]),
    ]
    expect(deriveCreditDimensions(groups)).toEqual({})
  })

  it('нет «Расхода» → пусто (сработает штатный фолбэк)', () => {
    const groups = [
      accumulation([
        { _movementKind: 'Приход', PodrazdelenieOrganizatsii: podr(1, 'A') },
      ]),
    ]
    expect(deriveCreditDimensions(groups)).toEqual({})
  })

  it('дубли одного и того же расходного подразделения схлопываются в одно', () => {
    const groups = [
      accumulation([
        { _movementKind: 'Расход', PodrazdelenieOrganizatsii: podr(5, 'X') },
        { _movementKind: 'Расход', PodrazdelenieOrganizatsii: podr(5, 'X') },
      ]),
    ]
    expect(deriveCreditDimensions(groups)).toEqual({ Podrazdelenie: podr(5, 'X') })
  })
})
