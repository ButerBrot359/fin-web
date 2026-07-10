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
    const cols = [col('Nomenklatura'), account('SchetUcheta'), col('Summa')]
    expect(resolveAccountAutofill(cols)).toEqual({
      trigger: 'nomenklatura',
      triggerCol: 'Nomenklatura',
      schetUchetaCol: 'SchetUcheta',
    })
  })

  it('ОС/НМА: триггер — ВидВНА, отдельные счёт учёта и счёт амортизации', () => {
    const cols = [
      col('VidVna'),
      account('SchetUcheta'),
      account('SchetUchetaAmortizatsii'),
      col('SrokPoleznogoIspolzovaniya'),
      col('NachislyatAmortizatsiyu', { dataType: 'BOOLEAN' }),
    ]
    expect(resolveAccountAutofill(cols)).toEqual({
      trigger: 'vidVna',
      triggerCol: 'VidVna',
      schetUchetaCol: 'SchetUcheta',
      schetAmortizatsiiCol: 'SchetUchetaAmortizatsii',
      spiCol: 'SrokPoleznogoIspolzovaniya',
      nachislyatCol: 'NachislyatAmortizatsiyu',
    })
  })

  it('ВидВНА в приоритете над Номенклатурой; счёт амортизации не путается с учётным', () => {
    const cols = [
      account('SchetUchetaAmortizatsii'),
      account('SchetUcheta'),
      col('VidVna'),
    ]
    const cfg = resolveAccountAutofill(cols)
    expect(cfg?.trigger).toBe('vidVna')
    expect(cfg?.schetUchetaCol).toBe('SchetUcheta')
    expect(cfg?.schetAmortizatsiiCol).toBe('SchetUchetaAmortizatsii')
  })

  it('нет счёта учёта или триггера → null', () => {
    expect(resolveAccountAutofill([col('Nomenklatura')])).toBeNull()
    expect(resolveAccountAutofill([account('SchetUcheta')])).toBeNull()
  })
})

describe('accountAutofillUrl', () => {
  it('строит URL по триггеру', () => {
    expect(
      accountAutofillUrl(
        { trigger: 'nomenklatura', triggerCol: 'Nomenklatura', schetUchetaCol: 'SchetUcheta' },
        42
      )
    ).toBe('/api/nomenklatura/42/schet-ucheta')
    expect(
      accountAutofillUrl(
        { trigger: 'vidVna', triggerCol: 'VidVna', schetUchetaCol: 'SchetUcheta' },
        7
      )
    ).toBe('/api/vneoborotnye-aktivy/vid-vna/7/uchet-params')
  })
})

describe('buildAccountRef', () => {
  it('id для сохранения + код для показа', () => {
    expect(buildAccountRef(148, '2411')).toEqual({
      id: 148,
      code: '2411',
      displayName: '2411',
    })
  })
})
