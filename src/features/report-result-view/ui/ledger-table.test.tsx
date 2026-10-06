import { act, render, screen, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ReportColumnDto,
  ReportResultDto,
} from '@/pages/reports/report-list/types/report'

import { LedgerTable } from './ledger-table'

afterEach(cleanup)

const resultOf = (columns: ReportColumnDto[]): ReportResultDto =>
  ({
    reportCode: 'ZhurnalVydannykhDoverennostey',
    reportNameRu: 'Журнал учёта выданных доверенностей',
    columns,
    rows: [
      {
        level: 0,
        rowKind: 'DATA',
        cells: { Nomer: '000001', Postavshchik: 'ТОО Ромашка' },
        children: [],
      },
    ],
    total: {},
    layout: 'LEDGER',
  }) as unknown as ReportResultDto

describe('LedgerTable — строка номеров граф', () => {
  it('рисует номера граф отдельной строкой под шапкой, как в макете 1С', () => {
    const columns: ReportColumnDto[] = [
      {
        code: 'Nomer',
        titleRu: '№ доверенности',
        role: 'ATTRIBUTE',
        valueType: 'STRING',
        columnNumber: '1',
      },
      {
        code: 'Postavshchik',
        titleRu: 'Поставщик',
        role: 'ATTRIBUTE',
        valueType: 'STRING',
        columnNumber: '5',
      },
    ]

    render(<LedgerTable result={resultOf(columns)} columns={columns} />)

    const numbersRow = screen.getByTestId('report-column-numbers')
    expect(
      Array.from(numbersRow.querySelectorAll('th')).map((th) => th.textContent)
    ).toEqual(['1', '5'])
    expect(numbersRow.parentElement?.lastElementChild).toBe(numbersRow)
  })

  it('без номеров у колонок лишней строки в шапке нет', () => {
    const columns: ReportColumnDto[] = [
      { code: 'Nomer', titleRu: '№', role: 'ATTRIBUTE', valueType: 'STRING' },
    ]

    render(<LedgerTable result={resultOf(columns)} columns={columns} />)

    expect(screen.queryByTestId('report-column-numbers')).toBeNull()
  })
})

describe('LedgerTable — шапка по headerPath', () => {
  it('строит многоуровневую шапку и поворачивает verticalTitle', () => {
    const columns: ReportColumnDto[] = [
      {
        code: 'Nomer',
        titleRu: '№',
        role: 'ATTRIBUTE',
        valueType: 'STRING',
        columnNumber: '1',
      },
      {
        code: 'Postavshchik',
        titleRu: 'Разряд',
        role: 'ATTRIBUTE',
        valueType: 'STRING',
        headerPathRu: ['Тарификация', 'Основные'],
        verticalTitle: true,
        columnNumber: '2',
      },
    ]

    const { container } = render(
      <LedgerTable result={resultOf(columns)} columns={columns} />
    )

    const headRows = container.querySelectorAll('thead tr')
    expect(headRows).toHaveLength(4)
    const first = headRows[0].querySelectorAll('th')
    expect(first[0].textContent).toBe('№')
    expect(first[0].getAttribute('rowspan')).toBe('3')
    expect(first[1].textContent).toBe('Тарификация')
    const leaf = screen.getByText('Разряд')
    expect(leaf.getAttribute('data-vertical')).toBe('true')
    expect(leaf.style.transform).toBe('rotate(180deg)')
    expect(
      screen.getByText('Тарификация').getAttribute('data-vertical')
    ).toBeNull()
    expect(headRows[3].getAttribute('data-testid')).toBe(
      'report-column-numbers'
    )
  })
})

describe('LedgerTable — шапка по groupTitle/subGroupTitle', () => {
  const nagruzka = (
    code: string,
    subGroupTitleRu: string
  ): ReportColumnDto => ({
    code,
    titleRu: 'Количество часов в неделю',
    role: 'ATTRIBUTE',
    valueType: 'DECIMAL',
    groupTitleRu: 'Основные часы',
    subGroupTitleRu,
  })

  it('выводит средний ряд подгрупп, чтобы одноимённые колонки различались', () => {
    const columns: ReportColumnDto[] = [
      { code: 'Nomer', titleRu: '№', role: 'ATTRIBUTE', valueType: 'STRING' },
      nagruzka('Chasy_1_4', '1-4 кл'),
      nagruzka('Chasy_5_9', '5-9 кл'),
      {
        code: 'ChasyVsego',
        titleRu: 'Количество часов, всего',
        role: 'ATTRIBUTE',
        valueType: 'DECIMAL',
        groupTitleRu: 'Основные часы',
      },
    ]

    const { container } = render(
      <LedgerTable result={resultOf(columns)} columns={columns} />
    )

    const headRows = container.querySelectorAll('thead tr')
    expect(headRows).toHaveLength(3)
    const top = headRows[0].querySelectorAll('th')
    expect(top[0].textContent).toBe('№')
    expect(top[0].getAttribute('rowspan')).toBe('3')
    expect(top[1].textContent).toBe('Основные часы')
    expect(top[1].getAttribute('colspan')).toBe('3')
    const mid = Array.from(headRows[1].querySelectorAll('th'))
    expect(mid.map((c) => c.textContent)).toEqual([
      '1-4 кл',
      '5-9 кл',
      'Количество часов, всего',
    ])
    expect(mid[2].getAttribute('rowspan')).toBe('2')
    expect(
      Array.from(headRows[2].querySelectorAll('th')).map((c) => c.textContent)
    ).toEqual(['Количество часов в неделю', 'Количество часов в неделю'])
  })

  it('без subGroupTitle шапка остаётся двухуровневой', () => {
    const columns: ReportColumnDto[] = [
      { code: 'Nomer', titleRu: '№', role: 'ATTRIBUTE', valueType: 'STRING' },
      { ...nagruzka('Chasy_1_4', ''), subGroupTitleRu: undefined },
    ]

    const { container } = render(
      <LedgerTable result={resultOf(columns)} columns={columns} />
    )

    const headRows = container.querySelectorAll('thead tr')
    expect(headRows).toHaveLength(2)
    expect(headRows[0].querySelector('th')?.getAttribute('rowspan')).toBe('2')
  })
})

describe('LedgerTable — масштаб страницы и ширина контейнера', () => {
  const columns: ReportColumnDto[] = ['A', 'B', 'C', 'D'].map((code) => ({
    code,
    titleRu: code,
    role: 'ATTRIBUTE',
    valueType: 'STRING',
  }))

  let width = 2000
  let zoom = 1
  let observerCallback: (() => void) | null = null
  const restore: (() => void)[] = []

  const stubProp = (name: string, get: () => number) => {
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>
    const own = Object.getOwnPropertyDescriptor(proto, name)
    Object.defineProperty(proto, name, { configurable: true, get })
    restore.push(() => {
      if (own) Object.defineProperty(proto, name, own)
      else Reflect.deleteProperty(proto, name)
    })
  }

  beforeEach(() => {
    width = 2000
    zoom = 1
    observerCallback = null
    stubProp('clientWidth', () => width)
    stubProp('offsetWidth', () => width)
    stubProp('currentCSSZoom', () => zoom)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          observerCallback = cb
        }
        observe = vi.fn()
        disconnect = vi.fn()
      }
    )
  })

  afterEach(() => {
    restore.splice(0).forEach((fn) => {
      fn()
    })
    vi.unstubAllGlobals()
  })

  const colWidths = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('col')).map((c) =>
      parseFloat(c.style.width)
    )
  const total = (container: HTMLElement) =>
    colWidths(container).reduce((a, b) => a + b, 0)
  const resizeTo = (next: number) => {
    width = next
    act(() => {
      observerCallback?.()
    })
  }

  it('при сужении контейнера колонки подгоняются заново, при расширении возвращаются', () => {
    const { container } = render(
      <LedgerTable result={resultOf(columns)} columns={columns} />
    )
    const natural = total(container)

    resizeTo(300)
    expect(total(container)).toBeLessThan(natural)

    resizeTo(2000)
    expect(total(container)).toBe(natural)
  })

  it('после ручного ресайза смена ширины не перетирает ширины пользователя', () => {
    const { container } = render(
      <LedgerTable result={resultOf(columns)} columns={columns} />
    )
    const handle = container.querySelector('.cursor-col-resize')
    if (!handle) throw new Error('нет ручки ресайза')
    fireEvent.mouseDown(handle, { clientX: 100 })
    fireEvent.mouseMove(document, { clientX: 150 })
    fireEvent.mouseUp(document)
    const manual = colWidths(container)

    resizeTo(300)
    expect(colWidths(container)).toEqual(manual)
  })

  it('при повторной подгонке горизонтальная прокрутка сохраняет долю хода', () => {
    const { container } = render(
      <LedgerTable result={resultOf(columns)} columns={columns} />
    )
    const scroller = container.firstElementChild as HTMLElement
    stubProp('scrollWidth', () => total(container))
    width = 100
    scroller.scrollLeft = (total(container) - width) / 2

    resizeTo(100)

    expect(total(container)).toBeGreaterThan(width)
    expect(scroller.scrollLeft).toBeCloseTo((total(container) - width) / 2)
  })

  it('ресайз колонки при масштабе учитывает zoom: граница идёт за курсором', () => {
    zoom = 1.5
    const { container } = render(
      <LedgerTable result={resultOf(columns)} columns={columns} />
    )
    const before = colWidths(container)[0]
    const handle = container.querySelector('.cursor-col-resize')
    if (!handle) throw new Error('нет ручки ресайза')

    fireEvent.mouseDown(handle, { clientX: 100 })
    fireEvent.mouseMove(document, { clientX: 250 })
    fireEvent.mouseUp(document)

    expect(colWidths(container)[0]).toBe(before + 100)
  })
})
