import { describe, expect, it } from 'vitest'

import type {
  ReportAltColumnDto,
  ReportAltResultDto,
} from '../../types/reportalt'

import { buildReportAltExport } from './build-reportalt-export'

const treeResult = (columns: ReportAltColumnDto[]): ReportAltResultDto =>
  ({
    reportCode: 'Forma420',
    reportNameRu: 'Форма 4-20',
    columns,
    rows: [],
    total: {},
    layout: 'TREE',
  }) as unknown as ReportAltResultDto

describe('buildReportAltExport — строка номеров граф', () => {
  it('добавляет номера граф отдельной строкой под двухуровневой шапкой', () => {
    const columns: ReportAltColumnDto[] = [
      {
        code: 'Kod',
        titleRu: 'Код',
        role: 'DIMENSION',
        valueType: 'STRING',
        columnNumber: '1',
      },
      {
        code: 'SummaPlana',
        titleRu: 'по обязательствам',
        groupTitleRu: 'План финансирования с начала года',
        role: 'MEASURE',
        valueType: 'NUMBER',
        columnNumber: '4',
      },
      {
        code: 'PlatezhPlan',
        titleRu: 'по платежам',
        groupTitleRu: 'План финансирования с начала года',
        role: 'MEASURE',
        valueType: 'NUMBER',
        columnNumber: '5',
      },
    ]

    const data = buildReportAltExport(
      treeResult(columns),
      false,
      'Группировка',
      'Итого'
    )

    expect(data.headerRows).toEqual([
      [
        { text: 'Группировка', col: 0, rowSpan: 2 },
        { text: 'Код', col: 1, rowSpan: 2 },
        { text: 'План финансирования с начала года', col: 2, colSpan: 2 },
      ],
      [
        { text: 'по обязательствам', col: 2 },
        { text: 'по платежам', col: 3 },
      ],
      [
        { text: '', col: 0 },
        { text: '1', col: 1 },
        { text: '4', col: 2 },
        { text: '5', col: 3 },
      ],
    ])
  })

  it('LEDGER: номера граф идут строкой под шапкой без служебной колонки', () => {
    const data = buildReportAltExport(
      {
        ...treeResult([
          {
            code: 'Nomer',
            titleRu: '№ доверенности',
            role: 'ATTRIBUTE',
            valueType: 'STRING',
            columnNumber: '1',
          },
          {
            code: 'Data',
            titleRu: 'Дата выдачи',
            role: 'ATTRIBUTE',
            valueType: 'STRING',
            columnNumber: '2',
          },
        ]),
        layout: 'LEDGER',
      },
      false,
      'Группировка',
      'Итого'
    )

    expect(data.headerRows).toEqual([
      [
        { text: '№ доверенности', col: 0 },
        { text: 'Дата выдачи', col: 1 },
      ],
      [
        { text: '1', col: 0 },
        { text: '2', col: 1 },
      ],
    ])
  })

  it('без номеров у колонок шапка остаётся одноуровневой', () => {
    const data = buildReportAltExport(
      treeResult([
        { code: 'Kod', titleRu: 'Код', role: 'DIMENSION', valueType: 'STRING' },
      ]),
      false,
      'Группировка',
      'Итого'
    )

    expect(data.headerRows).toBeUndefined()
    expect(data.headers).toEqual(['Группировка', 'Код'])
  })
})
