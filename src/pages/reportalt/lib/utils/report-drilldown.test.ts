import { describe, expect, it } from 'vitest'

import type { ReportAltRowDto } from '../../types/reportalt'

import {
  buildDrilldownTargets,
  resolveDrilldownKinds,
} from './report-drilldown'

const accountRow: ReportAltRowDto = {
  level: 0,
  groupCode: 'Schet',
  groupRefId: 99,
  groupValue: '1316',
  rowRef: { domain: 'ACCOUNT_PLAN', typeCode: 'EPSGU', id: 99 },
  cells: {},
  children: [],
}

const dimensionRow: ReportAltRowDto = {
  level: 1,
  groupCode: 'Organizatsiya',
  groupRefId: 7,
  groupValue: 'Аппарат акима',
  cells: {},
  children: [],
}

const subkontoRow: ReportAltRowDto = {
  level: 2,
  groupCode: 'Subkonto1',
  groupRefId: 700,
  groupValue: 'Бумага А4',
  rowRef: { domain: 'DICTIONARY', typeCode: 'Nomenklatura', id: 700 },
  cells: {},
  children: [],
}

const corrAccountRow: ReportAltRowDto = {
  level: 1,
  groupCode: 'KorrSchet',
  groupRefId: 3310,
  groupValue: '3310',
  rowRef: { domain: 'ACCOUNT_PLAN', typeCode: 'EPSGU', id: 3310 },
  cells: {},
  children: [],
}

const period = { from: '2026-09-01', to: '2026-09-12' }

describe('resolveDrilldownKinds — состав меню расшифровки по эталону', () => {
  it('ОСВ: пять целей в порядке эталона', () => {
    expect(
      resolveDrilldownKinds({
        reportCode: 'OborotnoSaldovayaVedomost',
        chain: [accountRow],
        accountRow,
        valueRow: accountRow,
      })
    ).toEqual([
      'osvPoSchetu',
      'accountCard',
      'analizScheta',
      'turnoverByMonths',
      'turnoverByDays',
    ])
  })

  it('ОСВ по счёту: только карточка счёта', () => {
    expect(
      resolveDrilldownKinds({
        reportCode: 'OSVPoSchetu',
        chain: [accountRow, subkontoRow],
        accountRow,
        valueRow: subkontoRow,
      })
    ).toEqual(['accountCard'])
  })

  it('Анализ счёта: на строке кор. счёта — отчёт по проводкам', () => {
    expect(
      resolveDrilldownKinds({
        reportCode: 'AnalizScheta',
        chain: [accountRow, corrAccountRow],
        accountRow,
        valueRow: corrAccountRow,
      })
    ).toEqual(['postingsReport'])
  })

  it('Анализ счёта: на обычной строке — карточка счёта', () => {
    expect(
      resolveDrilldownKinds({
        reportCode: 'AnalizScheta',
        chain: [accountRow, dimensionRow],
        accountRow,
        valueRow: dimensionRow,
      })
    ).toEqual(['accountCard'])
  })

  it('Анализ субконто: со счётом — карточка счёта, без счёта — карточка субконто', () => {
    expect(
      resolveDrilldownKinds({
        reportCode: 'AnalizSubkonto',
        chain: [accountRow, subkontoRow],
        accountRow,
        valueRow: subkontoRow,
      })
    ).toEqual(['accountCard'])
    expect(
      resolveDrilldownKinds({
        reportCode: 'AnalizSubkonto',
        chain: [subkontoRow],
        valueRow: subkontoRow,
      })
    ).toEqual(['subkontoCard'])
  })

  it('Обороты счёта: отчёт по проводкам', () => {
    expect(
      resolveDrilldownKinds({
        reportCode: 'OborotyScheta',
        chain: [accountRow],
        accountRow,
        valueRow: accountRow,
      })
    ).toEqual(['postingsReport'])
  })

  it('Отчёт без правила эталона целей не предлагает', () => {
    expect(
      resolveDrilldownKinds({
        reportCode: 'KartochkaScheta',
        chain: [accountRow],
        accountRow,
        valueRow: accountRow,
      })
    ).toEqual([])
  })
})

describe('buildDrilldownTargets — параметры целевых отчётов', () => {
  it('ОСВ: счёт, период и организация уходят в целевые отчёты, периодичность 9 и 6', () => {
    const targets = buildDrilldownTargets({
      reportCode: 'OborotnoSaldovayaVedomost',
      chain: [accountRow, dimensionRow],
      accountRow,
      valueRow: dimensionRow,
      ...period,
    })

    expect(targets.map((t) => t.kind)).toEqual([
      'osvPoSchetu',
      'analizScheta',
      'turnoverByMonths',
      'turnoverByDays',
    ])

    const osv = targets[0]
    expect(osv.reportCode).toBe('OSVPoSchetu')
    expect(osv.params.get('Schet')).toBe('99')
    expect(osv.params.get('Organizatsiya')).toBe('7')
    expect(osv.params.get('Period')).toBe(
      JSON.stringify({ from: '2026-09-01', to: '2026-09-12' })
    )

    expect(targets[2].reportCode).toBe('OborotyScheta')
    expect(targets[2].params.get('Periodichnost')).toBe('9')
    expect(targets[3].params.get('Periodichnost')).toBe('6')
  })

  it('«Карточка счёта» цели-отчёта не даёт — её открывает страница по своему маршруту', () => {
    const targets = buildDrilldownTargets({
      reportCode: 'AnalizScheta',
      chain: [accountRow, dimensionRow],
      accountRow,
      valueRow: dimensionRow,
      ...period,
    })

    expect(targets).toEqual([])
  })

  it('Карточка субконто получает значение субконто и измерения строки', () => {
    const fkrRow: ReportAltRowDto = {
      level: 1,
      groupCode: 'FKR',
      groupRefId: 12,
      groupValue: '124/008/032',
      cells: {},
      children: [],
    }
    const targets = buildDrilldownTargets({
      reportCode: 'AnalizSubkonto',
      chain: [fkrRow, subkontoRow],
      valueRow: subkontoRow,
      ...period,
    })

    expect(targets).toHaveLength(1)
    expect(targets[0].reportCode).toBe('KartochkaSubkonto')
    expect(targets[0].params.get('ZnachenieSubkonto')).toBe('[700]')
    expect(targets[0].params.get('Fkr')).toBe('12')
  })

  it('Отчёт по проводкам на строке кор. счёта Анализа счёта', () => {
    const targets = buildDrilldownTargets({
      reportCode: 'AnalizScheta',
      chain: [accountRow, corrAccountRow],
      accountRow,
      valueRow: corrAccountRow,
      ...period,
    })

    expect(targets).toHaveLength(1)
    expect(targets[0].reportCode).toBe('OtchetPoProvodkam')
    expect(targets[0].params.get('Schet')).toBe('99')
  })
})
