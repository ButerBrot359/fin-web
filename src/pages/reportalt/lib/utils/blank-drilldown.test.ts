import { describe, expect, it } from 'vitest'

import {
  otkazRasshifrovki,
  periodRasshifrovki,
  rasshifrovkaKletki,
} from './blank-drilldown'

const KVARTAL = { from: '2026-07-01', to: '2026-09-30' }

describe('Расшифровка клетки бланка', () => {
  it('графы 1–3 дают месяц квартала, графа 4 — весь период', () => {
    expect(periodRasshifrovki('1', KVARTAL.from, KVARTAL.to)).toEqual({
      from: '2026-07-01',
      to: '2026-07-31',
    })
    expect(periodRasshifrovki('2', KVARTAL.from, KVARTAL.to)).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    })
    expect(periodRasshifrovki('3', KVARTAL.from, KVARTAL.to)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    })
    expect(periodRasshifrovki('4', KVARTAL.from, KVARTAL.to)).toEqual(KVARTAL)
  })

  it('клетка строки формы ведёт в регистр налогового учёта за свой месяц', () => {
    const target = rasshifrovkaKletki('s_200_00_005_2', 30267, KVARTAL)

    expect(target?.reportCode).toBe('RegistrNalogovogoUchetaPoIPNiSN')
    expect(target?.params.get('Organizatsiya')).toBe('30267')
    expect(target?.params.get('Period')).toBe(
      JSON.stringify({ from: '2026-08-01', to: '2026-08-31' })
    )
    expect(target?.params.get('rr')).toBe('1')
    expect(target?.params.get('TolkoGrazhdaneRK')).toBe('true')
  })

  it('клетки приложения 200.01 расшифровываются так же, как основной формы', () => {
    expect(rasshifrovkaKletki('s_200_01_012_4', 1, KVARTAL)?.reportCode).toBe(
      'RegistrNalogovogoUchetaPoIPNiSN'
    )
  })

  it('клетки вне строк формы и приложения 200.01 не расшифровываются', () => {
    expect(rasshifrovkaKletki('Руководитель', 1, KVARTAL)).toBeNull()
    expect(rasshifrovkaKletki('s_200_02_001_1', 1, KVARTAL)).toBeNull()
    expect(rasshifrovkaKletki(null, 1, KVARTAL)).toBeNull()
  })

  it('без периода расшифровка недоступна — не из чего строить отбор', () => {
    expect(rasshifrovkaKletki('s_200_00_001_1', 1, null)).toBeNull()
  })

  it('строки только для индивидуального предпринимателя у юрлица не расшифровываются', () => {
    for (const oblast of [
      's_200_00_004_1',
      's_200_00_007_4',
      's_200_00_009_2',
      's_200_01_009_3',
      's_200_01_015_1',
    ]) {
      expect(otkazRasshifrovki(oblast)).toBe('tolkoIP')
      expect(rasshifrovkaKletki(oblast, 1, KVARTAL)).toBeNull()
    }
    expect(otkazRasshifrovki('s_200_00_005_1')).toBeNull()
    expect(otkazRasshifrovki('s_200_01_013_1')).toBeNull()
  })

  it('клетка вне расшифровываемых строк получает отказ «не поддерживается»', () => {
    expect(otkazRasshifrovki('Руководитель')).toBe('nePodderzhivaetsya')
    expect(otkazRasshifrovki('s_200_02_001_1')).toBe('nePodderzhivaetsya')
    expect(otkazRasshifrovki(null)).toBeNull()
  })
})
