import { describe, expect, it } from 'vitest'

import type { ReportAltRowDto } from '../../types/reportalt'

import { buildDrilldownTargets } from './report-drilldown'

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

const period = { from: '2026-09-01', to: '2026-09-12' }

describe('buildDrilldownTargets', () => {
  it('для строки субконто даёт карточку субконто, проводки и обороты по дням и месяцам', () => {
    const targets = buildDrilldownTargets({
      chain: [accountRow, dimensionRow, subkontoRow],
      accountRow,
      valueRow: subkontoRow,
      ...period,
    })

    expect(targets.map((tg) => tg.kind)).toEqual([
      'subkontoCard',
      'postingsReport',
      'turnoverByDays',
      'turnoverByMonths',
    ])

    const card = targets[0]
    expect(card.reportCode).toBe('KartochkaSubkonto')
    expect(card.params.get('ZnachenieSubkonto')).toBe('[700]')
    expect(card.params.get('Period')).toBe(
      JSON.stringify({ from: '2026-09-01', to: '2026-09-12' })
    )
    expect(card.params.get('Organizatsiya')).toBe('7')

    const postings = targets[1]
    expect(postings.reportCode).toBe('OtchetPoProvodkam')
    expect(postings.params.get('Schet')).toBe('99')
    expect(postings.params.get('Organizatsiya')).toBe('7')

    expect(targets[2].reportCode).toBe('OborotyScheta')
    expect(targets[2].params.get('Periodichnost')).toBe('6')
    expect(targets[3].params.get('Periodichnost')).toBe('9')
  })

  it('строка без субконто карточку субконто не предлагает', () => {
    const targets = buildDrilldownTargets({
      chain: [accountRow, dimensionRow],
      accountRow,
      valueRow: dimensionRow,
      ...period,
    })

    expect(targets.map((tg) => tg.kind)).toEqual([
      'postingsReport',
      'turnoverByDays',
      'turnoverByMonths',
    ])
  })

  it('без строки счёта остаются только цели по значению строки', () => {
    const targets = buildDrilldownTargets({
      chain: [subkontoRow],
      valueRow: subkontoRow,
      ...period,
    })

    expect(targets.map((tg) => tg.kind)).toEqual(['subkontoCard'])
  })

  it('измерения кор. отчётов не попадают в цели, которым они неизвестны', () => {
    const fkrRow: ReportAltRowDto = {
      level: 1,
      groupCode: 'FKR',
      groupRefId: 12,
      groupValue: '124/008/032',
      cells: {},
      children: [],
    }
    const targets = buildDrilldownTargets({
      chain: [accountRow, fkrRow, subkontoRow],
      accountRow,
      valueRow: subkontoRow,
      ...period,
    })

    expect(targets[0].params.get('Fkr')).toBe('12')
    expect(targets[1].params.get('Fkr')).toBeNull()
  })
})
