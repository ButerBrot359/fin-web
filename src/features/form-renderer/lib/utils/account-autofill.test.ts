import { describe, expect, it } from 'vitest'

import type { DocumentAttribute } from '@/entities/document-type'

import {
  resolveAccountAutofill,
  accountAutofillUrl,
  buildAccountRef,
} from './account-autofill'

const col = (
  code: string,
  extra: Partial<DocumentAttribute> = {}
): DocumentAttribute =>
  ({ code, code1C: '', dataType: 'STRING', ...extra }) as DocumentAttribute

const account = (code: string): DocumentAttribute =>
  col(code, {
    dataType: 'ACCOUNT_PLAN',
    allowedTypes: [
      { domainKind: 'ACCOUNT_PLAN', typeCode: 'EPSGU' },
    ] as DocumentAttribute['allowedTypes'],
  })

describe('resolveAccountAutofill', () => {
  it('ТМЗ/Услуги: триггер — Номенклатура, цель — Счёт учёта', () => {
    const cfg = resolveAccountAutofill([
      col('Nomenklatura'),
      account('SchetUcheta'),
      col('Summa'),
    ])
    expect(cfg?.triggers).toEqual([
      { kind: 'nomenklatura', triggerCol: 'Nomenklatura' },
    ])
    expect(cfg?.targets.schetUchetaCol).toBe('SchetUcheta')
  })

  it('ОС/НМА: два триггера (актив + ВидВНА) и расширенные цели', () => {
    const cfg = resolveAccountAutofill([
      col('OsnovnoeSredstvo'),
      col('VidVna'),
      account('SchetUcheta'),
      account('SchetUchetaAmortizatsii'),
      col('PervonachalnayaStoimost'),
      col('TekushchayaStoimost'),
      col('SrokPoleznogoIspolzovaniya'),
      col('NachislyatAmortizatsiyu', { dataType: 'BOOLEAN' }),
    ])
    expect(cfg?.triggers).toEqual([
      { kind: 'asset', triggerCol: 'OsnovnoeSredstvo' },
      { kind: 'vidVna', triggerCol: 'VidVna' },
    ])
    expect(cfg?.targets).toEqual({
      schetUchetaCol: 'SchetUcheta',
      schetAmortizatsiiCol: 'SchetUchetaAmortizatsii',
      vidVnaCol: 'VidVna',
      spiCol: 'SrokPoleznogoIspolzovaniya',
      nachislyatCol: 'NachislyatAmortizatsiyu',
      pervonachalnayaStoimostCol: 'PervonachalnayaStoimost',
      tekushchayaStoimostCol: 'TekushchayaStoimost',
    })
  })

  it('счёт учёта не путается со счётом амортизации', () => {
    const cfg = resolveAccountAutofill([
      account('SchetUchetaAmortizatsii'),
      account('SchetUcheta'),
      col('VidVna'),
    ])
    expect(cfg?.targets.schetUchetaCol).toBe('SchetUcheta')
    expect(cfg?.targets.schetAmortizatsiiCol).toBe('SchetUchetaAmortizatsii')
  })

  it('нет счёта учёта или триггера → null', () => {
    expect(resolveAccountAutofill([col('Nomenklatura')])).toBeNull()
    expect(resolveAccountAutofill([account('SchetUcheta')])).toBeNull()
  })
})

describe('accountAutofillUrl', () => {
  it('строит URL по типу триггера', () => {
    expect(accountAutofillUrl('asset', 12)).toBe(
      '/api/vneoborotnye-aktivy/asset/12/uchet-params'
    )
    expect(accountAutofillUrl('vidVna', 7)).toBe(
      '/api/vneoborotnye-aktivy/vid-vna/7/uchet-params'
    )
    expect(accountAutofillUrl('nomenklatura', 42)).toBe(
      '/api/nomenklatura/42/schet-ucheta'
    )
  })
})

describe('buildAccountRef', () => {
  it('id для сохранения + код для показа', () => {
    expect(buildAccountRef(148, '2360')).toEqual({
      id: 148,
      code: '2360',
      displayName: '2360',
    })
  })
})
