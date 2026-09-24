import { render, screen, fireEvent, cleanup } from '@testing-library/react'
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
