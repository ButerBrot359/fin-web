import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearParamDraft,
  initialParamRaw,
  readParamDraft,
  saveParamDraft,
} from './param-draft'
import type { ReportAltParameterDto } from '../../types/reportalt'

const param = (code: string): ReportAltParameterDto =>
  ({
    code,
    dataType: 'STRING',
    titleRu: code,
    titleKz: code,
  }) as ReportAltParameterDto

describe('черновик параметров отчёта', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('сохранённый отбор читается обратно в том же виде, что уходит в URL', () => {
    saveParamDraft('Forma420', {
      Organizatsiya: 12,
      Period: { from: '2026-09-01', to: '2026-09-30' },
    })

    expect(readParamDraft('Forma420')).toEqual({
      Organizatsiya: '12',
      Period: '{"from":"2026-09-01","to":"2026-09-30"}',
    })
  })

  it('черновики разных отчётов не смешиваются', () => {
    saveParamDraft('Forma420', { Kontragent: 1 })
    saveParamDraft('GU5_15', { Kontragent: 2 })

    expect(readParamDraft('Forma420')).toEqual({ Kontragent: '1' })
    expect(readParamDraft('GU5_15')).toEqual({ Kontragent: '2' })
  })

  it('пустой, отсутствующий и битый черновик дают пустую карту', () => {
    expect(readParamDraft('Forma420')).toEqual({})
    sessionStorage.setItem('reportalt-draft:Forma420', 'не json')
    expect(readParamDraft('Forma420')).toEqual({})
  })

  it('clearParamDraft убирает только свой отчёт', () => {
    saveParamDraft('Forma420', { Kontragent: 1 })
    saveParamDraft('GU5_15', { Kontragent: 2 })

    clearParamDraft('Forma420')

    expect(readParamDraft('Forma420')).toEqual({})
    expect(readParamDraft('GU5_15')).toEqual({ Kontragent: '2' })
  })

  it('URL главнее черновика: на экране таблица по применённым параметрам', () => {
    const draft = { Kontragent: '7' }
    expect(initialParamRaw(param('Kontragent'), '5', draft)).toBe('5')
    expect(initialParamRaw(param('Kontragent'), null, draft)).toBe('7')
    expect(initialParamRaw(param('Spetsifika'), null, draft)).toBeNull()
  })

  it('пустая строка в URL — это применённое пустое значение, а не «нет значения»', () => {
    expect(initialParamRaw(param('Kontragent'), '', { Kontragent: '7' })).toBe(
      ''
    )
  })
})
