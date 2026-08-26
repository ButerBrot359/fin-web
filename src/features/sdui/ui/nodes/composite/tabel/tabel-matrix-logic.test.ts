import { describe, expect, it } from 'vitest'

import { parseTabelMatrixPayload } from './tabel-matrix-contract'
import {
  buildReplaceEmployee,
  countKindDays,
  dayHeader,
  filterEmployees,
  formatHours,
  listIntervalDays,
  normalizeCellInput,
} from './tabel-matrix-logic'
import { validPayload } from './tabel-matrix-contract.test'

const payload = parseTabelMatrixPayload(validPayload)!

describe('listIntervalDays: месяцы разной длины (acceptance §9.2)', () => {
  it.each([
    ['2026-02-01', '2026-02-28', 28],
    ['2024-02-01', '2024-02-29', 29],
    ['2026-04-01', '2026-04-30', 30],
    ['2026-08-01', '2026-08-31', 31],
  ])('%s..%s → %i дней', (start, end, count) => {
    const days = listIntervalDays({ start, end })
    expect(days).toHaveLength(count)
    expect(days[0]).toBe(start)
    expect(days.at(-1)).toBe(end)
  })

  it('битый интервал → пусто', () => {
    expect(listIntervalDays({ start: 'oops', end: '2026-08-31' })).toEqual([])
  })

  it('интервал длиннее месяца обрезается защитой', () => {
    expect(
      listIntervalDays({ start: '2026-01-01', end: '2026-12-31' }).length
    ).toBeLessThanOrEqual(40)
  })
})

describe('dayHeader', () => {
  it('будний день: номер + день недели', () => {
    const h = dayHeader('2026-08-12') // среда
    expect(h.dayNum).toBe('12')
    expect(h.weekday).toBe('Ср')
    expect(h.weekend).toBe(false)
  })

  it('суббота и воскресенье помечены weekend', () => {
    expect(dayHeader('2026-08-15').weekend).toBe(true)
    expect(dayHeader('2026-08-16').weekend).toBe(true)
  })
})

describe('formatHours: компактно, не storage precision (§5)', () => {
  it.each([
    ['8.0', '8'],
    ['7.50', '7.5'],
    ['8', '8'],
    ['', ''],
    [undefined, ''],
  ])('%s → %s', (input, expected) => {
    expect(formatHours(input)).toBe(expected)
  })
})

describe('normalizeCellInput: 1..24, пусто = отсутствие ячейки', () => {
  it.each([
    ['8', '8'],
    ['7,5', '7.5'],
    [' 24 ', '24'],
    ['', null],
    ['   ', null],
  ])('«%s» → %s', (input, expected) => {
    expect(normalizeCellInput(input)).toEqual({ ok: true, value: expected })
  })

  it.each(['0', '0.5', '25', '-1', 'abc', '8h'])('«%s» → отклонён', (input) => {
    expect(normalizeCellInput(input)).toEqual({ ok: false })
  })
})

describe('buildReplaceEmployee: полный replacement subtree (§4)', () => {
  it('правка ячейки: отправляются ВСЕ виды, включая protected', () => {
    const cmd = buildReplaceEmployee(payload, 'employee:42', {
      workTimeKindRef: 101,
      date: '2026-08-13',
      value: '8',
    })
    expect(cmd).not.toBeNull()
    expect(cmd?.baseGeneration).toBe(17)
    expect(cmd?.employee.workKinds).toHaveLength(2)
    expect(cmd?.employee.workKinds[0].cells).toEqual({
      '2026-08-12': '8',
      '2026-08-13': '8',
    })
    // protected-вид уходит в составе subtree нетронутым
    expect(cmd?.employee.workKinds[1]).toEqual({
      workTimeKindRef: 200,
      cells: {},
    })
  })

  it('value=null удаляет ячейку, а не пишет «0»', () => {
    const cmd = buildReplaceEmployee(payload, 'employee:42', {
      workTimeKindRef: 101,
      date: '2026-08-12',
      value: null,
    })
    expect(cmd?.employee.workKinds[0].cells).toEqual({})
  })

  it('черновые виды добавляются в subtree, дубликаты existing не плодятся', () => {
    const cmd = buildReplaceEmployee(
      payload,
      'employee:42',
      { workTimeKindRef: 300, date: '2026-08-14', value: '4' },
      [300, 101]
    )
    expect(cmd?.employee.workKinds).toHaveLength(3)
    expect(cmd?.employee.workKinds[2]).toEqual({
      workTimeKindRef: 300,
      cells: { '2026-08-14': '4' },
    })
  })

  it('исчезнувший сотрудник → null (команда отменяется в очереди)', () => {
    expect(buildReplaceEmployee(payload, 'employee:999', null)).toBeNull()
  })
})

describe('countKindDays / filterEmployees', () => {
  it('дни с часами', () => {
    expect(countKindDays({ a: '8', b: '', c: '4' })).toBe(2)
  })

  it('поиск по presentation без регистра', () => {
    expect(filterEmployees(payload.employees, 'иванов')).toHaveLength(1)
    expect(filterEmployees(payload.employees, 'петров')).toHaveLength(0)
    expect(filterEmployees(payload.employees, '  ')).toHaveLength(1)
  })
})
