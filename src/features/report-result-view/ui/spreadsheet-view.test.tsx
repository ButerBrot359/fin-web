import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ReportSpreadsheetDto } from '@/pages/reports/report-list/types/report'

import { SpreadsheetView } from './spreadsheet-view'

afterEach(cleanup)

/**
 * Бланки регламентированной отчётности утверждены приказом: сетка, цвета и рамки приходят
 * готовыми с бэка. Проверяем, что рендер не теряет клетки и не сдвигает колонки — именно
 * из-за сдвига бланк выглядел бы «не как в 1С».
 */
describe('SpreadsheetView — табличный документ бланка', () => {
  const dokument: ReportSpreadsheetDto = {
    sheets: [
      {
        code: 'Страница 1',
        title: 'Страница 1',
        columnWidths: [40, 60, 80],
        rowHeights: [20, 20],
        cells: [
          {
            row: 0,
            column: 0,
            colSpan: 2,
            text: 'Форма 200.00',
            style: { background: '#FF0000', color: '#FFFFFF', bold: true },
          },
          { row: 1, column: 2, text: 'ИИН' },
        ],
      },
      {
        code: 'Страница 2',
        title: 'Страница 2',
        columnWidths: [50],
        rowHeights: [20],
        cells: [{ row: 0, column: 0, text: 'Расчётные показатели' }],
      },
    ],
  }

  it('первая страница рисуется с оформлением бланка', () => {
    render(<SpreadsheetView spreadsheet={dokument} />)

    const yacheyka = screen.getByText('Форма 200.00')
    expect(yacheyka.getAttribute('colspan')).toBe('2')
    expect(yacheyka.style.backgroundColor).toBe('rgb(255, 0, 0)')
    expect(yacheyka.style.color).toBe('rgb(255, 255, 255)')
  })

  it('пропуски заполняются пустыми клетками — колонки не съезжают', () => {
    const { container } = render(<SpreadsheetView spreadsheet={dokument} />)

    const stroki = container.querySelectorAll('tbody tr')
    expect(stroki).toHaveLength(2)
    // Вторая строка: две пустые клетки перед «ИИН» в третьей колонке.
    const vtoraya = stroki[1].querySelectorAll('td')
    expect(vtoraya).toHaveLength(3)
    expect(vtoraya[2].textContent).toBe('ИИН')
  })

  it('страницы переключаются, как в списке страниц 1С', () => {
    render(<SpreadsheetView spreadsheet={dokument} />)

    fireEvent.click(screen.getByRole('button', { name: 'Страница 2' }))

    expect(screen.getByText('Расчётные показатели')).toBeTruthy()
  })

  it('пустой документ ничего не рисует', () => {
    const { container } = render(
      <SpreadsheetView spreadsheet={{ sheets: [] }} />
    )

    expect(container.querySelector('table')).toBeNull()
  })

  it('клетка ввода бланка редактируется, изменение уходит наружу', () => {
    const dokumentSVvodom: ReportSpreadsheetDto = {
      sheets: [
        {
          code: 'Страница 1',
          title: 'Страница 1',
          columnWidths: [80],
          rowHeights: [20],
          cells: [
            {
              row: 0,
              column: 0,
              text: '',
              field: 'НомерУведомления',
              editable: true,
            },
          ],
        },
      ],
    }
    const izmeneniya: [string, string][] = []

    render(
      <SpreadsheetView
        spreadsheet={dokumentSVvodom}
        blankValues={{}}
        onBlankValueChange={(field, value) => {
          izmeneniya.push([field, value])
        }}
      />
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '42' } })

    expect(izmeneniya).toEqual([['НомерУведомления', '42']])
  })

  it('без обработчика бланк только для чтения — полей ввода нет', () => {
    const { container } = render(<SpreadsheetView spreadsheet={dokument} />)

    expect(container.querySelector('input')).toBeNull()
  })

  it('клик по клетке отдаёт имя её области — по нему строится расшифровка', () => {
    const dokumentSOblastyu: ReportSpreadsheetDto = {
      sheets: [
        {
          code: 'Страница 1',
          title: 'Страница 1',
          columnWidths: [80, 80],
          rowHeights: [20],
          cells: [
            { row: 0, column: 0, text: '100', field: 's_200_00_001_1' },
            { row: 0, column: 1, text: 'без области' },
          ],
        },
      ],
    }
    const vybrano: (string | null)[] = []

    render(
      <SpreadsheetView
        spreadsheet={dokumentSOblastyu}
        onVyborOblasti={(oblast: string | null) => {
          vybrano.push(oblast)
        }}
      />
    )
    fireEvent.click(screen.getByText('100'))
    fireEvent.click(screen.getByText('без области'))

    expect(vybrano).toEqual(['s_200_00_001_1', null])
  })

  it('очищенная область показывается пустой и без обработчика ввода', () => {
    const dokumentSOblastyu: ReportSpreadsheetDto = {
      sheets: [
        {
          code: 'Страница 1',
          title: 'Страница 1',
          columnWidths: [80],
          rowHeights: [20],
          cells: [{ row: 0, column: 0, text: '100', field: 's_200_00_001_1' }],
        },
      ],
    }

    render(
      <SpreadsheetView
        spreadsheet={dokumentSOblastyu}
        blankValues={{ s_200_00_001_1: '' }}
      />
    )

    expect(screen.queryByText('100')).toBeNull()
  })

  it('список страниц плоский, сворачиваются только экземпляры многостраничного раздела', () => {
    const list = (title: string, mnogostranichnyy = false) => ({
      code: title,
      title,
      mnogostranichnyy,
      columnWidths: [40],
      rowHeights: [20],
      cells: [{ row: 0, column: 0, text: title }],
    })
    const dokument: ReportSpreadsheetDto = {
      sheets: [
        list('Страница 1'),
        list('200.02 стр.1'),
        list('200.03 стр.1', true),
        list('200.03 стр.1 (2)', true),
      ],
    }

    render(<SpreadsheetView spreadsheet={dokument} />)

    // «Страница 1» в списке две: страница самой формы и первый экземпляр приложения 3.
    expect(screen.getAllByRole('button', { name: 'Страница 1' })).toHaveLength(
      2
    )
    expect(screen.getByRole('button', { name: '200.02 стр.1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '▾ 200.03 стр.1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Страница 2' })).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: '200.03 стр.1 (2)' })
    ).toBeNull()
  })
})
