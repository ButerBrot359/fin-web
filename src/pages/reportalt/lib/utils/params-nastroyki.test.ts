import { describe, expect, it } from 'vitest'

import { GRUPPA_NASTROEK, LANG_PARAM_CODE } from './params'
import type { ReportAltParameterDto } from '../../types/reportalt'

const param = (code: string, group?: string): ReportAltParameterDto => ({
  code,
  titleRu: code,
  dataType: 'STRING',
  required: false,
  ...(group ? { group } : {}),
})

/**
 * Состав шапки отчёта решает описание параметра, а не вёрстка: в 1С над отчётом стоят период и
 * организация, а отборы и детализация задаются в «Настройках».
 */
describe('Разделение параметров между шапкой и настройками', () => {
  const parametry = [
    param('Period'),
    param('Organizatsiya'),
    param('SchetaPoRazvernutomuSaldo', GRUPPA_NASTROEK),
    param('Gruppirovka', GRUPPA_NASTROEK),
    param(LANG_PARAM_CODE),
  ]

  it('в шапку идут параметры без группы настроек и без языка формы', () => {
    const v = parametry.filter(
      (p) => p.code !== LANG_PARAM_CODE && p.group !== GRUPPA_NASTROEK
    )

    expect(v.map((p) => p.code)).toEqual(['Period', 'Organizatsiya'])
  })

  it('в настройки идут только помеченные группой', () => {
    const n = parametry.filter((p) => p.group === GRUPPA_NASTROEK)

    expect(n.map((p) => p.code)).toEqual([
      'SchetaPoRazvernutomuSaldo',
      'Gruppirovka',
    ])
  })

  it('параметр без группы наверху — снятие группы возвращает его в шапку', () => {
    const bezGruppy = {
      ...param('Podrazdelenie', GRUPPA_NASTROEK),
      group: undefined,
    }

    expect(bezGruppy.group).toBeUndefined()
  })
})
