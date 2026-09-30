import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ReportFormDto } from '@/pages/reports/report-list/types/report'

import { FormView } from './form-view'

afterEach(cleanup)

/**
 * МО-5 (свод расчётных ведомостей) отдаёт колонку описания операции БЕЗ заголовка —
 * в эталоне ф405 у неё пустая шапка. Пока бланк читал `col.titleRu.length` напрямую,
 * такая колонка роняла весь экран отчёта: «Что-то пошло не так — Cannot read
 * properties of null (reading 'length')» (найдено на dev 16.09.2026).
 */
describe('FormView — колонка без заголовка', () => {
  const form = (titleRu: string | null): ReportFormDto => ({
    title: '№ 5 Мемориальный ордер',
    sections: [
      {
        columns: [
          { code: 'F405Opisanie', titleRu } as never,
          { code: 'F405Summa', titleRu: 'Сумма, тенге' } as never,
        ],
        rows: [
          { level: 0, cells: { F405Opisanie: 'Начислено', F405Summa: 100 } },
        ],
      } as never,
    ],
  })

  it('titleRu = null — бланк рендерится, а не падает', () => {
    render(<FormView form={form(null)} />)

    expect(screen.getByText('Сумма, тенге')).toBeTruthy()
    expect(screen.getByText('Начислено')).toBeTruthy()
  })

  it('пустой titleRu — шапка пустая, данные на месте', () => {
    render(<FormView form={form('')} />)

    expect(screen.getByText('Сумма, тенге')).toBeTruthy()
    expect(screen.getByText('100')).toBeTruthy()
  })
})

describe('FormView — строка номеров граф', () => {
  const form = (numbers: (string | undefined)[]): ReportFormDto => ({
    title: 'Расчетная ведомость',
    sections: [
      {
        numberGraphs: true,
        graphNumberStart: 1,
        columns: numbers.map((n, i) => ({
          code: `C${String(i)}`,
          titleRu: `Графа ${String(i)}`,
          columnNumber: n,
        })) as never,
        rows: [],
      } as never,
    ],
  })

  it('без явных номеров графы нумеруются подряд с graphNumberStart', () => {
    render(<FormView form={form([undefined, undefined, undefined])} />)

    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('явный номер колонки печатается как есть', () => {
    render(<FormView form={form(['1', '9=6-7'])} />)

    expect(screen.getByText('9=6-7')).toBeTruthy()
    expect(screen.queryByText('2')).toBeNull()
  })
})

describe('FormView — бланк по ширине страницы (fitToWidth)', () => {
  const form = (fitToWidth: boolean): ReportFormDto => ({
    title: 'Мемориальный ордер №5',
    sections: [
      {
        fitToWidth,
        columns: [
          { code: 'F405Opisanie', titleRu: '', width: 35, wrap: true },
          { code: 'F405Summa', titleRu: 'Сумма, тенге', width: 14 },
        ] as never,
        rows: [{ level: 0, cells: { F405Opisanie: 'Начислено' } }],
      } as never,
    ],
  })

  it('ширины граф задаются долями страницы', () => {
    const { container } = render(<FormView form={form(true)} />)

    const cols = container.querySelectorAll('col')
    expect(cols[0].style.width).toMatch(/%$/)
    expect(cols[1].style.width).toMatch(/%$/)
    expect(container.querySelector('table')?.style.minWidth).not.toBe('')
  })

  it('без флага ширины остаются в пикселях', () => {
    const { container } = render(<FormView form={form(false)} />)

    expect(container.querySelectorAll('col')[0].style.width).toBe('280px')
    expect(container.querySelector('table')?.style.minWidth).toBe('')
  })
})
