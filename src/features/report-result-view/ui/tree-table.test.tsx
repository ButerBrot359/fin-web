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

    expect(() =>
      fireEvent.contextMenu(screen.getByText('1316'))
    ).not.toThrow()
  })
})