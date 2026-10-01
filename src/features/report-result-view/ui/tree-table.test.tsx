import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  ReportColumnDto,
  ReportResultDto,
  ReportRowDto,
} from '@/pages/reports/report-list/types/report'

import { TreeTable } from './tree-table'

vi.mock('@/shared/assets/icons/arrow-down.svg', () => ({ default: () => null }))

const columns: ReportColumnDto[] = [
  { code: 'Schet', titleRu: 'Счёт', role: 'DIMENSION', valueType: 'STRING' },
  {
    code: 'OstatokKonechnyyDt',
    titleRu: 'Сальдо Дт',
    role: 'MEASURE',
    valueType: 'NUMBER',
  },
]

const subkontoRow: ReportRowDto = {
  level: 1,
  groupCode: 'Subkonto1',
  groupValue: 'Бумага А4',
  rowRef: { domain: 'DICTIONARY', typeCode: 'Nomenklatura', id: 700 },
  cells: { OstatokKonechnyyDt: 150 },
  children: [],
}

const accountRow: ReportRowDto = {
  level: 0,
  groupCode: 'Schet',
  groupValue: '1316',
  rowRef: { domain: 'ACCOUNT_PLAN', typeCode: 'EPSGU', id: 99 },
  cells: { OstatokKonechnyyDt: 150 },
  children: [subkontoRow],
}

const result: ReportResultDto = {
  reportCode: 'OSVPoSchetu',
  reportNameRu: 'ОСВ по счёту',
  columns,
  rows: [accountRow],
  total: {},
  layout: 'TREE',
} as unknown as ReportResultDto

afterEach(cleanup)

describe('TreeTable — переходы по строке', () => {
  it('двойной клик отдаёт кликнутую строку и цепочку родителей', () => {
    const calls: { row: ReportRowDto; ancestors: ReportRowDto[] }[] = []
    const onRowDoubleClick = (row: ReportRowDto, ancestors: ReportRowDto[]) => {
      calls.push({ row, ancestors })
    }
    render(
      <TreeTable
        result={result}
        columns={columns}
        onRowDoubleClick={onRowDoubleClick}
      />
    )

    fireEvent.doubleClick(screen.getByText('Бумага А4'))

    expect(calls).toHaveLength(1)
    expect(calls[0]?.row.groupValue).toBe('Бумага А4')
    expect(calls[0]?.ancestors.map((a) => a.groupValue)).toEqual(['1316'])

    fireEvent.doubleClick(screen.getAllByText(/150/)[0])

    expect(calls).toHaveLength(2)
    expect(calls[1]?.row.groupValue).toBe('1316')
  })

  it('двойной клик сообщает зону: подпись строки — label, сумма — value', () => {
    const zones: { value: string | undefined; zone: string }[] = []
    render(
      <TreeTable
        result={result}
        columns={columns}
        onRowDoubleClick={(row, _ancestors, _event, zone) => {
          zones.push({ value: row.groupValue, zone })
        }}
      />
    )

    fireEvent.doubleClick(screen.getByText('Бумага А4'))
    fireEvent.doubleClick(screen.getAllByText(/150/)[1])

    expect(zones).toEqual([
      { value: 'Бумага А4', zone: 'label' },
      { value: 'Бумага А4', zone: 'value' },
    ])
  })

  it('без обработчика строки не кликабельны', () => {
    render(<TreeTable result={result} columns={columns} />)

    expect(screen.getByText('1316').closest('tr')?.className).not.toContain(
      'cursor-pointer'
    )
  })
  it('правый клик по строке зовёт onRowContextMenu и подавляет меню браузера', () => {
    const calls: { value: string | undefined; defaultPrevented: boolean }[] = []
    render(
      <TreeTable
        result={result}
        columns={columns}
        onRowContextMenu={(row, _ancestors, event) => {
          calls.push({
            value: row.groupValue,
            defaultPrevented: event.defaultPrevented,
          })
        }}
      />
    )

    fireEvent.contextMenu(screen.getByText('1316'))

    expect(calls).toHaveLength(1)
    expect(calls[0]?.value).toBe('1316')
    expect(calls[0]?.defaultPrevented).toBe(true)
  })

  it('без onRowContextMenu правый клик ничего не делает', () => {
    render(<TreeTable result={result} columns={columns} />)

    expect(() => fireEvent.contextMenu(screen.getByText('1316'))).not.toThrow()
  })
})
describe('TreeTable — дерево с этажами', () => {
  const floorColumns: ReportColumnDto[] = [
    { code: 'Schet', titleRu: 'Счёт', role: 'DIMENSION', valueType: 'STRING' },
    {
      code: 'Nomenklatura',
      titleRu: 'Номенклатура',
      role: 'FIELD',
      valueType: 'STRING',
    },
    {
      code: 'OstatokKonechnyyDt',
      titleRu: 'Сальдо Дт',
      role: 'MEASURE',
      valueType: 'NUMBER',
    },
  ] as unknown as ReportColumnDto[]

  const listovayaStroka: ReportRowDto = {
    level: 1,
    cells: { Nomenklatura: 'Бумага А4', OstatokKonechnyyDt: 150 },
    rowRef: { domain: 'DICTIONARY', typeCode: 'Nomenklatura', id: 700 },
    children: [],
  } as unknown as ReportRowDto

  const floorResult = {
    ...result,
    columns: floorColumns,
    groupFloorCodes: ['Schet'],
    rows: [{ ...accountRow, children: [listovayaStroka] }],
  } as unknown as ReportResultDto

  const strokaNomenklatury = () => screen.getByText('Бумага А4').closest('tr')!

  it('двойной клик по строке работает и когда шапка построена этажами', () => {
    const calls: ReportRowDto[] = []
    render(
      <TreeTable
        result={floorResult}
        columns={floorColumns}
        onRowDoubleClick={(row) => calls.push(row)}
      />
    )

    fireEvent.doubleClick(strokaNomenklatury())

    expect(calls).toHaveLength(1)
    expect(calls[0].cells.Nomenklatura).toBe('Бумага А4')
  })

  it('правый клик по строке этажного дерева открывает меню', () => {
    const calls: ReportRowDto[] = []
    render(
      <TreeTable
        result={floorResult}
        columns={floorColumns}
        onRowContextMenu={(row) => calls.push(row)}
      />
    )

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    })
    strokaNomenklatury().dispatchEvent(event)

    expect(calls).toHaveLength(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('в этажном дереве реквизит строки — label, показатель — value', () => {
    const zones: string[] = []
    render(
      <TreeTable
        result={floorResult}
        columns={floorColumns}
        onRowDoubleClick={(_row, _ancestors, _event, zone) => zones.push(zone)}
      />
    )

    const cells = strokaNomenklatury().querySelectorAll('td')
    fireEvent.doubleClick(cells[0])
    fireEvent.doubleClick(cells[cells.length - 1])

    expect(zones).toEqual(['label', 'value'])
  })

  it('шапка этажного дерева закреплена при прокрутке таблицы', () => {
    const { container } = render(
      <TreeTable result={floorResult} columns={floorColumns} />
    )

    expect(container.querySelector('thead')?.className).toContain('sticky')
    expect(
      container.querySelector('table')?.parentElement?.className
    ).toContain('max-h-[75vh]')
  })

  it('без обработчиков строки этажного дерева не кликабельны', () => {
    render(<TreeTable result={floorResult} columns={floorColumns} />)

    expect(strokaNomenklatury().className).not.toContain('cursor-pointer')
  })
})

describe('TreeTable — этажи без колонок деталей (ОСВ)', () => {
  const osvResult = {
    ...result,
    reportCode: 'OborotnoSaldovayaVedomost',
    groupFloorCodes: ['Schet'],
  } as unknown as ReportResultDto

  it('счёт и субконто выводятся в колонке «Счёт», пустых колонок нет', () => {
    const { container } = render(
      <TreeTable result={osvResult} columns={columns} />
    )

    const shapka = [...container.querySelectorAll('thead th')].map(
      (th) => th.textContent
    )
    expect(shapka).toEqual(['Счёт', 'Сальдо Дт'])
    expect(container.querySelectorAll('thead tr')).toHaveLength(1)
    expect(container.querySelectorAll('colgroup col')).toHaveLength(2)

    for (const text of ['1316', 'Бумага А4']) {
      const stroka = screen.getByText(text).closest('tr')!
      expect(stroka.querySelectorAll('td')).toHaveLength(2)
    }
  })

  it('ОСВ по счёту: колонки субконто не выводятся, уровни подписаны в шапке колонки «Счёт»', () => {
    const osvPoSchetuColumns = [
      columns[0],
      {
        code: 'Subkonto1',
        titleRu: 'Физические лица',
        role: 'DIMENSION',
        valueType: 'STRING',
      },
      {
        code: 'Subkonto2',
        titleRu: 'Субконто 2',
        role: 'DIMENSION',
        valueType: 'STRING',
      },
      {
        code: 'Subkonto3',
        titleRu: 'Субконто 3',
        role: 'DIMENSION',
        valueType: 'STRING',
      },
      columns[1],
    ] as unknown as ReportColumnDto[]
    const osvPoSchetu = {
      ...result,
      columns: osvPoSchetuColumns,
      groupFloorCodes: ['Schet', 'Subkonto1'],
    } as unknown as ReportResultDto

    const { container } = render(
      <TreeTable result={osvPoSchetu} columns={osvPoSchetuColumns} />
    )

    const shapka = [...container.querySelectorAll('thead th')].map((th) =>
      [...th.querySelectorAll('p, span')].map((el) => el.textContent)
    )
    expect(shapka).toEqual([['Счёт', 'Физические лица'], ['Сальдо Дт']])
    expect(container.querySelectorAll('colgroup col')).toHaveLength(2)
    for (const text of ['1316', 'Бумага А4']) {
      const stroka = screen.getByText(text).closest('tr')!
      expect(stroka.querySelectorAll('td')).toHaveLength(2)
    }
  })

  it('шапка граф в две строки: группа периода над «Дебет»/«Кредит», как в 1С', () => {
    const grafy = [
      columns[0],
      {
        code: 'OstatokKonechnyyDt',
        titleRu: 'Дебет',
        groupTitleRu: 'Сальдо на конец периода',
        role: 'MEASURE',
        valueType: 'NUMBER',
      },
      {
        code: 'OstatokKonechnyyKt',
        titleRu: 'Кредит',
        groupTitleRu: 'Сальдо на конец периода',
        role: 'MEASURE',
        valueType: 'NUMBER',
      },
    ] as unknown as ReportColumnDto[]
    const { container } = render(
      <TreeTable
        result={{ ...osvResult, columns: grafy } as unknown as ReportResultDto}
        columns={grafy}
      />
    )

    const ryady = [...container.querySelectorAll('thead tr')].map((tr) =>
      [...tr.querySelectorAll('th')].map((th) => th.textContent)
    )
    expect(ryady).toEqual([
      ['Счёт', 'Сальдо на конец периода'],
      ['Дебет', 'Кредит'],
    ])
  })
})

describe('TreeTable — строка «Итого» одна', () => {
  const itogo: ReportRowDto = {
    level: 0,
    rowKind: 'TOTAL',
    labelText: 'Итого',
    cells: { OstatokKonechnyyDt: 150 },
    children: [],
  } as unknown as ReportRowDto

  const sItogom = (extra: Partial<ReportResultDto>) =>
    ({
      ...result,
      rows: [accountRow, itogo],
      total: { OstatokKonechnyyDt: 150 },
      ...extra,
    }) as unknown as ReportResultDto

  it('обычное дерево не дублирует итог, пришедший строкой', () => {
    const { container } = render(
      <TreeTable result={sItogom({})} columns={columns} />
    )

    expect(screen.getAllByText('Итого')).toHaveLength(1)
    expect(container.querySelector('tfoot')).toBeNull()
  })

  it('этажное дерево не дублирует итог, пришедший строкой', () => {
    const sDetalyami = [
      columns[0],
      { code: 'Nomenklatura', titleRu: 'Номенклатура', role: 'ATTRIBUTE' },
      columns[1],
    ] as unknown as ReportColumnDto[]
    const { container } = render(
      <TreeTable
        result={sItogom({ groupFloorCodes: ['Schet'], columns: sDetalyami })}
        columns={sDetalyami}
      />
    )

    expect(screen.getByText('Номенклатура')).toBeTruthy()

    expect(screen.getAllByText('Итого')).toHaveLength(1)
    expect(container.querySelector('tfoot')).toBeNull()
  })

  it('без итоговой строки общий итог выводится внизу', () => {
    const { container } = render(
      <TreeTable result={sItogom({ rows: [accountRow] })} columns={columns} />
    )

    expect(container.querySelector('tfoot')).not.toBeNull()
  })
})

describe('TreeTable — условное оформление строки (эталон 1С)', () => {
  const stroka = (
    groupValue: string,
    extra: Partial<ReportRowDto>
  ): ReportRowDto =>
    ({
      level: 1,
      groupCode: 'Schet',
      groupValue,
      // rowKind=DATA, иначе строку верхнего уровня рендерер и так считает выделенной —
      // проверять было бы нечего.
      rowKind: 'DATA',
      cells: { OstatokKonechnyyDt: 150 },
      children: [],
      ...extra,
    }) as unknown as ReportRowDto

  const derevo = (rows: ReportRowDto[]) =>
    ({ ...result, rows }) as unknown as ReportResultDto

  it('appearance BOLD_GROUP выделяет строку счёта-группы', () => {
    render(
      <TreeTable
        result={derevo([
          stroka('1000', { appearance: ['BOLD_GROUP'] }),
          stroka('1010', {}),
        ])}
        columns={columns}
      />
    )

    // Жирность идёт через sx (emotion-класс), поэтому сверяем вычисленный стиль.
    const podpis = (text: string) =>
      window.getComputedStyle(screen.getByText(text)).fontWeight
    expect(podpis('1000')).toBe('700')
    expect(podpis('1010')).not.toBe('700')
  })

  it('blankColumns гасит графу в этой строке, но не в соседней', () => {
    render(
      <TreeTable
        result={derevo([
          stroka('1000', { blankColumns: ['OstatokKonechnyyDt'] }),
          stroka('1010', {}),
        ])}
        columns={columns}
      />
    )

    const pogashennaya = screen.getByText('1000').closest('tr')!
    const obychnaya = screen.getByText('1010').closest('tr')!
    // Значение одно и то же (150), гашение идёт по строке, а не по значению.
    expect(pogashennaya.textContent).not.toContain('150')
    expect(obychnaya.textContent).toContain('150')
  })
})

describe('TreeTable — этажи с подгруппой граф (оборотная ведомость ТМЗ)', () => {
  const kolonki = [
    { code: 'Mol', titleRu: 'МОЛ', role: 'DIMENSION', valueType: 'STRING' },
    {
      code: 'Nomenklatura',
      titleRu: 'Номенклатура',
      role: 'DIMENSION',
      valueType: 'STRING',
    },
    {
      code: 'NomerPoPoryadku',
      titleRu: '№ п/п',
      role: 'ATTRIBUTE',
      valueType: 'STRING',
    },
    {
      code: 'OstatokNachalnyySumma',
      titleRu: 'сумма',
      groupTitleRu: 'Остаток на 01.02.2026',
      valueType: 'NUMBER',
    },
    {
      code: 'Prikhod|3210 / 4242|Summa',
      titleRu: 'сумма',
      groupTitleRu: 'Оборот с 01.02.2026 - 24.09.2026',
      subGroupTitleRu: 'Итого приход · 3210 / "Амир и Д" ТОО',
      valueType: 'NUMBER',
    },
    {
      code: 'Raskhod|3210 / 4242|Summa',
      titleRu: 'сумма',
      groupTitleRu: 'Оборот с 01.02.2026 - 24.09.2026',
      subGroupTitleRu: 'Итого расход · 3210 / "Амир и Д" ТОО',
      valueType: 'NUMBER',
    },
  ] as unknown as ReportColumnDto[]

  const stroka = {
    level: 1,
    cells: {
      NomerPoPoryadku: 1,
      OstatokNachalnyySumma: 0,
      'Prikhod|3210 / 4242|Summa': 330000,
      'Raskhod|3210 / 4242|Summa': 165000,
    },
    children: [],
  } as unknown as ReportRowDto

  const rezultat = {
    ...result,
    columns: kolonki,
    groupFloorCodes: ['Mol', 'Nomenklatura'],
    rows: [
      {
        level: 0,
        groupCode: 'Mol',
        groupValue: 'АБИТАЕВА',
        cells: {},
        children: [stroka],
      },
    ],
  } as unknown as ReportResultDto

  it('подгруппа с контрагентом выводится отдельным рядом шапки между периодом и мерой', () => {
    render(<TreeTable result={rezultat} columns={kolonki} />)

    expect(screen.getByText('Оборот с 01.02.2026 - 24.09.2026')).toBeTruthy()
    const prikhod = screen.getByText('Итого приход · 3210 / "Амир и Д" ТОО')
    const raskhod = screen.getByText('Итого расход · 3210 / "Амир и Д" ТОО')
    expect(prikhod.closest('tr')).toBe(raskhod.closest('tr'))
    expect(prikhod.closest('tr')).not.toBe(
      screen.getByText('Оборот с 01.02.2026 - 24.09.2026').closest('tr')
    )
  })
})

describe('TreeTable — строка номеров граф', () => {
  it('рисует номера граф отдельной строкой под шапкой, как в макете 1С', () => {
    const numbered: ReportColumnDto[] = [
      {
        code: 'Kod',
        titleRu: 'Администратор / Программа / Подпрограмма / Специфика',
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
        code: 'Ostatok',
        titleRu: 'по обязательствам',
        groupTitleRu: 'Остаток средств',
        role: 'MEASURE',
        valueType: 'NUMBER',
        columnNumber: '11=4-6',
      },
    ]
    const numberedResult = {
      ...result,
      columns: numbered,
      rows: [
        {
          level: 0,
          groupCode: 'Kod',
          groupValue: '124',
          cells: { Kod: '124', SummaPlana: 10, Ostatok: 5 },
          children: [],
        },
      ],
    } as unknown as ReportResultDto

    render(<TreeTable result={numberedResult} columns={numbered} />)

    const numbersRow = screen.getByTestId('report-column-numbers')
    const cells = Array.from(numbersRow.querySelectorAll('th')).map(
      (th) => th.textContent
    )
    expect(cells).toEqual(['', '1', '4', '11=4-6'])
    expect(numbersRow.parentElement?.lastElementChild).toBe(numbersRow)
  })

  it('без номеров у колонок лишней строки в шапке нет', () => {
    render(<TreeTable result={result} columns={columns} />)

    expect(screen.queryByTestId('report-column-numbers')).toBeNull()
  })
})

describe('TreeTable — закреплённые колонки', () => {
  const frozenColumns: ReportColumnDto[] = [
    {
      code: 'Org',
      titleRu: 'Организация',
      role: 'DIMENSION',
      valueType: 'STRING',
    },
    {
      code: 'NomerPP',
      titleRu: '№ п/п',
      role: 'DIMENSION',
      valueType: 'STRING',
      width: 5,
      frozen: true,
    },
    {
      code: 'Nachisleno',
      titleRu: 'Всего начислено',
      role: 'ATTRIBUTE',
      valueType: 'DECIMAL',
      width: 15,
      frozen: true,
    },
    {
      code: 'Oklad',
      titleRu: 'Оклад',
      role: 'ATTRIBUTE',
      valueType: 'DECIMAL',
      width: 15,
    },
  ]
  const frozenResult = {
    reportCode: 'RaschetnayaVedomostOrganizatsii',
    reportNameRu: 'Расчетная ведомость организации',
    columns: frozenColumns,
    rows: [
      {
        level: 0,
        groupCode: 'Org',
        groupValue: 'Демонстрационная организация',
        cells: { NomerPP: 1, Nachisleno: 100, Oklad: 100 },
        children: [],
      },
    ],
    total: {},
    layout: 'TREE',
  } as unknown as ReportResultDto

  it('колонка дерева и ведущие frozen-колонки закреплены слева, остальные прокручиваются', () => {
    render(<TreeTable result={frozenResult} columns={frozenColumns} />)
    const header = (title: string) =>
      screen.getByText(title).closest('th') as HTMLElement

    expect(header('Организация').style.position).toBe('sticky')
    expect(header('Организация').style.left).toBe('0px')
    expect(header('№ п/п').style.position).toBe('sticky')
    expect(header('№ п/п').style.left).toBe('240px')
    expect(header('Всего начислено').style.left).toBe('280px')
    expect(header('Оклад').style.position).toBe('')
  })

  it('без frozen-колонок ничего не закрепляется', () => {
    const plain = frozenColumns.map((c) => ({ ...c, frozen: undefined }))
    render(
      <TreeTable result={{ ...frozenResult, columns: plain }} columns={plain} />
    )
    expect(
      (screen.getByText('Организация').closest('th') as HTMLElement).style
        .position
    ).toBe('')
  })
})

describe('TreeTable — ширины граф и перенос как в макете 1С', () => {
  const sized: ReportColumnDto[] = [
    {
      code: 'Kod',
      titleRu: 'Администратор / Программа / Подпрограмма / Специфика',
      role: 'DIMENSION',
      valueType: 'STRING',
      width: 23,
    },
    {
      code: 'Naim',
      titleRu: 'Наименование',
      role: 'DIMENSION',
      valueType: 'STRING',
      width: 41,
      wrap: true,
    },
  ]
  const sizedResult = {
    ...result,
    columns: sized,
    rows: [
      {
        level: 0,
        groupCode: 'Kod',
        groupValue: '124',
        cells: {
          Kod: '124',
          Naim: 'Аппарат акима города районного значения, села, поселка',
        },
        children: [],
      },
    ],
  } as unknown as ReportResultDto

  it('ширины заданы — таблица фиксированной ширины, шапка и отмеченная графа переносятся', () => {
    const { container } = render(
      <TreeTable result={sizedResult} columns={sized} />
    )

    const table = container.querySelector('table')
    expect(table?.style.width).toBe(`${String(240 + 23 * 8 + 41 * 8)}px`)
    const head = screen
      .getByText('Администратор / Программа / Подпрограмма / Специфика')
      .closest('th')
    expect(head?.className).toContain('whitespace-normal')
    const naim = screen
      .getByText('Аппарат акима города районного значения, села, поселка')
      .closest('td')
    expect(naim?.className).toContain('whitespace-normal')
  })

  it('ширины не заданы — прежняя раскладка без переноса', () => {
    const { container } = render(
      <TreeTable result={result} columns={columns} />
    )

    expect(container.querySelector('table')?.style.width).toBe('')
    expect(screen.getByText('Сальдо Дт').closest('th')?.className).toContain(
      'whitespace-nowrap'
    )
  })
})

describe('TreeTable — колонка дерева задана графой отчёта, как в 1С', () => {
  const grafy: ReportColumnDto[] = [
    {
      code: 'Kod',
      titleRu: 'Администратор / Программа / Подпрограмма / Специфика',
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
  ]
  const derevo = {
    ...result,
    columns: grafy,
    rows: [
      {
        level: 0,
        groupCode: 'KodAbp',
        groupValue: '124',
        cells: { Kod: '124', Naim: 'Аппарат акима' },
        children: [
          {
            level: 1,
            groupCode: 'Programma',
            groupValue: '001',
            cells: { Kod: '001', Naim: 'Услуги акима' },
            children: [],
          },
        ],
      },
    ],
  } as unknown as ReportResultDto

  it('нет отдельной «Группировки»: иерархия в графе 1, её заголовок и номер «1»', () => {
    const { container } = render(<TreeTable result={derevo} columns={grafy} />)

    const headers = Array.from(container.querySelectorAll('thead th')).map(
      (th) => th.textContent
    )
    expect(headers).not.toContain('reports.group')
    expect(headers[0]).toBe(
      'Администратор / Программа / Подпрограмма / Специфика'
    )
    const numbers = Array.from(
      screen.getByTestId('report-column-numbers').querySelectorAll('th')
    ).map((th) => th.textContent)
    expect(numbers).toEqual(['1', '2'])
    expect(screen.getAllByText('124')).toHaveLength(1)
    expect(screen.getByText('001')).toBeTruthy()
  })
})

describe('TreeTable — ведомости ВНА по форме КБП', () => {
  const mera = (
    code: string,
    titleRu: string,
    groupTitleRu?: string,
    subGroupTitleRu?: string
  ) =>
    ({
      code,
      titleRu,
      groupTitleRu,
      subGroupTitleRu,
      role: 'MEASURE',
      valueType: 'DECIMAL',
    }) as unknown as ReportColumnDto

  const dim = (code: string, titleRu: string) =>
    ({ code, titleRu, role: 'DIMENSION' }) as unknown as ReportColumnDto

  const rekvizit = (code: string, titleRu: string, groupTitleRu?: string) =>
    ({
      code,
      titleRu,
      groupTitleRu,
      role: 'ATTRIBUTE',
    }) as unknown as ReportColumnDto

  const stroka = {
    level: 3,
    cells: { NomerPoPoryadku: 1, VnaName: 'Автомобиль', OstatokNachalnyy: 100 },
    children: [],
  } as unknown as ReportRowDto

  const gruppa = (
    groupCode: string,
    groupValue: string,
    children: ReportRowDto[]
  ) =>
    ({
      level: 0,
      groupCode,
      groupValue,
      rowKind: 'GROUP_HEADER',
      cells: { OstatokNachalnyy: 100 },
      children,
    }) as unknown as ReportRowDto

  it('три этажа группировок: остатки и оборот с Дебет/Кредит раскладываются по рядам шапки, итог группы в строке группы', () => {
    const kolonki = [
      dim('Schet', 'Счет'),
      dim('Podrazdelenie', 'Подразделение'),
      dim('Mol', 'МОЛ'),
      rekvizit('NomerPoPoryadku', '№ п/п'),
      rekvizit('VnaName', 'Наименование'),
      mera('OstatokNachalnyy', 'сумма', 'Остаток на 30.09.2026'),
      mera('Postuplenie', 'сумма', 'Оборот с 30.09.2026 - 30.09.2026', 'Дебет'),
      mera('Vybytie', 'сумма', 'Оборот с 30.09.2026 - 30.09.2026', 'Кредит'),
    ]
    const rezultat = {
      ...result,
      columns: kolonki,
      groupFloorCodes: ['Schet', 'Podrazdelenie', 'Mol'],
      rows: [
        gruppa('Schet', '2350', [
          gruppa('Podrazdelenie', 'Штат', [
            gruppa('Mol', 'Трохлазова', [stroka]),
          ]),
        ]),
      ],
    } as unknown as ReportResultDto

    const { container } = render(
      <TreeTable result={rezultat} columns={kolonki} />
    )

    const ryady = container.querySelectorAll('thead tr')
    expect(ryady).toHaveLength(4)
    expect(screen.getByText('Остаток на 30.09.2026').closest('tr')).toBe(
      ryady[0]
    )
    expect(screen.getByText('Дебет').closest('tr')).toBe(ryady[1])
    const summy = screen.getAllByText('сумма')
    expect(summy[0].closest('th')?.getAttribute('rowspan')).toBe('3')
    expect(summy[1].closest('tr')).toBe(ryady[2])
    expect(summy[1].closest('th')?.getAttribute('rowspan')).toBe('2')
    expect(screen.getByText('2350').closest('tr')?.textContent).toContain('100')
  })

  it('два этажа и двухэтажная шапка детальных граф: группа «Дополнительные поля» у мер тоже выводится', () => {
    const kolonki = [
      dim('Podrazdelenie', 'Местонахождение'),
      dim('Mol', 'МОЛ'),
      rekvizit('NomerPoPoryadku', '№ п/п'),
      rekvizit('ZavodskoyNomer', 'Заводской номер', 'Дополнительные поля'),
      mera('StepenAmortizatsii', 'Степень амортизации', 'Дополнительные поля'),
      mera('Kolichestvo', 'Количество'),
    ]
    const rezultat = {
      ...result,
      columns: kolonki,
      groupFloorCodes: ['Podrazdelenie', 'Mol'],
      rows: [gruppa('Podrazdelenie', 'Штат', [stroka])],
    } as unknown as ReportResultDto

    const { container } = render(
      <TreeTable result={rezultat} columns={kolonki} />
    )

    expect(container.querySelectorAll('thead tr')).toHaveLength(4)
    expect(screen.getAllByText('Дополнительные поля')).toHaveLength(2)
    expect(
      screen.getByText('Количество').closest('th')?.getAttribute('rowspan')
    ).toBe('4')
    expect(
      screen
        .getByText('Степень амортизации')
        .closest('th')
        ?.getAttribute('rowspan')
    ).toBe('3')
  })
})

describe('TreeTable — уровни группировки', () => {
  const registrColumns: ReportColumnDto[] = [
    {
      code: 'FizicheskoeLitso',
      titleRu: 'Физическое лицо',
      role: 'DIMENSION',
      valueType: 'STRING',
    },
    {
      code: 'NachislenoDokhodov',
      titleRu: 'Начислено доходов',
      role: 'MEASURE',
      valueType: 'NUMBER',
    },
  ]

  const registrResult = {
    reportCode: 'RegistrNalogovogoUchetaPoIPNiSN',
    reportNameRu: 'Регистр налогового учёта по ИПН и СН',
    columns: registrColumns,
    rows: [
      {
        level: 0,
        rowKind: 'GROUP_HEADER',
        groupCode: 'Mesyats',
        groupValue: '10.2026',
        cells: { Mesyats: '10.2026' },
        children: [
          {
            level: 1,
            rowKind: 'DATA',
            groupCode: 'FizicheskoeLitso',
            groupValue: 'Иванов Иван',
            cells: { FizicheskoeLitso: 'Иванов Иван', NachislenoDokhodov: 500 },
            children: [],
          },
        ],
      },
    ],
    total: {},
    layout: 'TREE',
  } as unknown as ReportResultDto

  const levelButton = (level: string) =>
    within(screen.getByRole('toolbar')).getByText(level)

  it('кнопка «1» сворачивает дерево до месяцев, «2» раскрывает физлиц', () => {
    render(<TreeTable result={registrResult} columns={registrColumns} />)

    expect(screen.getAllByText('Иванов Иван').length).toBeGreaterThan(0)

    fireEvent.click(levelButton('1'))
    expect(screen.queryAllByText('Иванов Иван')).toHaveLength(0)
    expect(screen.getByText('10.2026')).toBeInTheDocument()

    fireEvent.click(levelButton('2'))
    expect(screen.getAllByText('Иванов Иван').length).toBeGreaterThan(0)
  })

  it('колонка дерева регистра: шапка в две строки, физлицо не дублируется отдельной графой', () => {
    const treeColumns = registrColumns.map((c) =>
      c.code === 'FizicheskoeLitso'
        ? {
            ...c,
            titleRu: 'Месяц налогового периода\nФизическое лицо',
            treeColumn: true,
          }
        : c
    )
    const { container } = render(
      <TreeTable
        result={{ ...registrResult, columns: treeColumns }}
        columns={treeColumns}
      />
    )

    const shapka = screen.getByText(/Месяц налогового периода/)
    expect(shapka).toHaveStyle({ whiteSpace: 'pre-line' })
    expect(container.querySelectorAll('thead th')).toHaveLength(2)
    expect(screen.getByText('10.2026')).toBeInTheDocument()
    expect(screen.getAllByText('Иванов Иван')).toHaveLength(1)
  })

  it('у плоского результата без групп кнопок уровней нет', () => {
    render(
      <TreeTable
        result={{ ...result, rows: [subkontoRow] }}
        columns={columns}
      />
    )

    expect(screen.queryByRole('toolbar')).toBeNull()
  })
})
