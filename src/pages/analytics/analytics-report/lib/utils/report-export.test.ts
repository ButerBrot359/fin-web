import { describe, expect, it } from 'vitest'

import type {
  AnalyticsColumn,
  AnalyticsQueryResult,
} from '@/entities/analytics'

import { buildReportCsv, sanitizeFileName } from './report-export'

const NBSP = '\u00A0'
const BOM = '\uFEFF'

const specColumns: AnalyticsColumn[] = [
  {
    name: 'name',
    label: 'Контрагент',
    labelKz: 'Контрагент (kz)',
    type: 'STRING',
    format: 'PLAIN',
  },
  { name: 'sum', label: 'Сумма', type: 'DECIMAL', format: 'MONEY' },
]

const result = (rows: unknown[][]): AnalyticsQueryResult => ({
  columns: [
    { name: 'name', type: 'STRING' },
    { name: 'sum', type: 'DECIMAL' },
  ],
  rows,
  rowCount: rows.length,
  truncated: false,
  executionMs: 1,
})

describe('buildReportCsv', () => {
  it('начинается с BOM, разделяет точкой с запятой и форматирует по спецификации', () => {
    const csv = buildReportCsv(specColumns, result([['ТОО Ромашка', '1234.5']]))

    expect(csv.startsWith(BOM)).toBe(true)
    expect(csv.slice(1)).toBe(`Контрагент;Сумма\r\nТОО Ромашка;1${NBSP}234,50`)
  })

  it('казахская локаль берёт labelKz, без него — label', () => {
    const csv = buildReportCsv(specColumns, result([]), 'kz')
    expect(csv.slice(1)).toBe('Контрагент (kz);Сумма')
  })

  it('колонка без описания в спецификации подписывается своим именем', () => {
    const csv = buildReportCsv([], result([]))
    expect(csv.slice(1)).toBe('name;sum')
  })

  it('удваивает кавычки и берёт ячейку в кавычки', () => {
    const csv = buildReportCsv(specColumns, result([['ООО "Ромашка"', null]]))
    expect(csv).toContain('"ООО ""Ромашка""";')
  })

  it('экранирует точку с запятой и переводы строк внутри ячейки', () => {
    const csv = buildReportCsv(
      specColumns,
      result([
        ['a;b', null],
        ['две\nстроки', null],
      ])
    )
    const lines = csv.slice(1).split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe('"a;b";')
    expect(lines[2]).toBe('"две\nстроки";')
  })
})

describe('sanitizeFileName', () => {
  it('заменяет запрещённые символы файловой системы пробелами', () => {
    expect(sanitizeFileName('ОСВ: счёт 60/62?')).toBe('ОСВ счёт 60 62')
  })

  it('схлопывает повторные пробелы и обрезает края', () => {
    expect(sanitizeFileName('  отчёт   за * месяц  ')).toBe('отчёт за месяц')
  })

  it('пустое после чистки имя заменяет на export', () => {
    expect(sanitizeFileName('***')).toBe('export')
    expect(sanitizeFileName('')).toBe('export')
  })
})
