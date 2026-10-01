import { describe, expect, it } from 'vitest'

import type { ReportAltRowDto } from '../../types/reportalt'

import { buildAccountCardParams } from './account-card-link'

const row = (
  groupCode: string,
  groupRefId: number,
  groupValue: string
): ReportAltRowDto => ({
  level: 0,
  groupCode,
  groupRefId,
  groupValue,
  cells: {},
  children: [],
})

describe('buildAccountCardParams', () => {
  it('переносит счёт, период и отборы по измерениям строки', () => {
    const params = buildAccountCardParams(
      [
        row('Schet', 99, '1316'),
        row('Podrazdelenie', 55, 'Бухгалтерия'),
        row('FKR', 12, '124/008/032'),
      ],
      {
        accountId: 99,
        accountCode: '1316',
        from: '2026-09-01T00:00:00',
        to: '2026-09-12T00:00:00',
      }
    )

    expect(params.get('accountId')).toBe('99')
    expect(params.get('accountCode')).toBe('1316')
    expect(params.get('from')).toBe('2026-09-01T00:00:00')
    expect(params.get('podrazdelenieId')).toBe('55')
    expect(params.get('fkrId')).toBe('12')
  })

  it('строки без измерения отбор не добавляют', () => {
    const params = buildAccountCardParams(
      [row('Subkonto1', 700, 'Бумага А4')],
      {
        accountId: 99,
      }
    )

    expect([...params.keys()]).toEqual(['accountId'])
  })

  it('организация и подразделение из параметров отчёта уходят в отбор, строка ветки приоритетнее', () => {
    const params = buildAccountCardParams(
      [row('Podrazdelenie', 55, 'Бухгалтерия')],
      {
        accountId: 99,
        parameters: {
          Organizatsiya: 30267,
          Podrazdelenie: 11,
          Period: { from: 'a', to: 'b' },
        },
      }
    )

    expect(params.get('organizatsiyaId')).toBe('30267')
    expect(params.get('podrazdelenieId')).toBe('55')
    expect(params.has('Period')).toBe(false)
  })
})
