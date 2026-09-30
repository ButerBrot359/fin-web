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

  it('колонка дерева задана графой — она ведущая, без «Группировки»', () => {
    const data = buildReportAltExport(
      {
        ...treeResult([
          {
            code: 'Kod',
            titleRu: 'Администратор / Программа',
            role: 'DIMENSION',
            valueType: 'STRING',
            columnNumber: '1',
            treeColumn: true,
          },
          {
            code: 'Naim',
            titleRu: 'Наименование',
            role: 'DIMENSION',
            valueType: 'STRING',
            columnNumber: '2',
          },
        ]),
        rows: [
          {
            level: 1,
            groupValue: '001',
            cells: { Kod: '001', Naim: 'Услуги' },
            children: [],
          },
        ],
      } as unknown as ReportAltResultDto,
      false,
      'Группировка',
      'Итого'
    )

    expect(data.headers).toEqual(['Администратор / Программа', 'Наименование'])
    expect(data.rows[0]).toEqual(['  001', 'Услуги'])
    expect(data.headerRows?.[1]).toEqual([
      { text: '1', col: 0 },
      { text: '2', col: 1 },
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

describe('buildReportAltExport — шапка по headerPath', () => {
  it('TREE: многоуровневые merge, поворот и строка номеров', () => {
    const columns: ReportAltColumnDto[] = [
      {
        code: 'Fio',
        titleRu: 'ФИО',
        role: 'DIMENSION',
        valueType: 'STRING',
        treeColumn: true,
      },
      {
        code: 'Razryad',
        titleRu: 'Разряд',
        role: 'ATTRIBUTE',
        valueType: 'STRING',
        headerPathRu: ['Тарификация', 'Основные'],
        headerPathVertical: [false, true],
        verticalTitle: true,
        columnNumber: '2',
      },
      {
        code: 'Stavka',
        titleRu: 'Ставка',
        role: 'MEASURE',
        valueType: 'NUMBER',
        headerPathRu: ['Тарификация', 'Основные'],
        columnNumber: '3',
      },
      {
        code: 'Itogo',
        titleRu: 'Итого',
        role: 'MEASURE',
        valueType: 'NUMBER',
        headerPathRu: ['Тарификация'],
        columnNumber: '4',
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
        { text: 'ФИО', col: 0, rowSpan: 3 },
        { text: 'Тарификация', col: 1, colSpan: 3 },
      ],
      [
        { text: 'Основные', col: 1, colSpan: 2, vertical: true },
        { text: 'Итого', col: 3, rowSpan: 2 },
      ],
      [
        { text: 'Разряд', col: 1, vertical: true },
        { text: 'Ставка', col: 2 },
      ],
      [
        { text: '', col: 0 },
        { text: '2', col: 1 },
        { text: '3', col: 2 },
        { text: '4', col: 3 },
      ],
    ])
  })

  it('LEDGER: шапка по headerPath выгружается и без номеров граф', () => {
    const data = buildReportAltExport(
      {
        ...treeResult([
          { code: 'A', titleRu: 'A', role: 'ATTRIBUTE', valueType: 'STRING' },
          {
            code: 'B',
            titleRu: 'B',
            role: 'ATTRIBUTE',
            valueType: 'STRING',
            headerPathRu: ['G'],
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
        { text: 'A', col: 0, rowSpan: 2 },
        { text: 'G', col: 1 },
      ],
      [{ text: 'B', col: 1 }],
    ])
  })
})

describe('buildReportAltExport — числовой формат колонок', () => {
  it('мера с форматом «#,##0» выгружается целым числом, без формата — с копейками', () => {
    const columns: ReportAltColumnDto[] = [
      {
        code: 'Kolichestvo',
        titleRu: 'Количество',
        role: 'MEASURE',
        valueType: 'DECIMAL',
        format: '#,##0',
      },
      {
        code: 'Summa',
        titleRu: 'Сумма',
        role: 'MEASURE',
        valueType: 'DECIMAL',
      },
    ] as ReportAltColumnDto[]

    const data = buildReportAltExport(
      treeResult(columns),
      false,
      'Группировка',
      'Итого'
    )

    expect(data.columns?.slice(1).map((c) => c.numFmt)).toEqual([
      'integer',
      'money',
    ])
  })
})
