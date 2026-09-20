import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Table, TableBody } from '@mui/material'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TableBodyRow } from './table-body-row'

afterEach(cleanup)

/** Минимальная строка TanStack: тесту нужны только index и видимые ячейки. */
const stroka = (yacheyka: React.ReactNode) =>
  ({
    id: 'r1',
    index: 0,
    original: { rowId: 'r1' },
    getVisibleCells: () => [
      {
        id: 'c1',
        column: { id: 'Nomenklatura', columnDef: { cell: () => yacheyka } },
        getContext: () => ({}),
      },
    ],
  }) as never

const otrisovat = (props: { selected: boolean; yacheyka: React.ReactNode }) =>
  render(
    <Table>
      <TableBody>
        <TableBodyRow
          row={stroka(props.yacheyka)}
          selected={props.selected}
          onRowClick={vi.fn()}
          onRowDoubleClick={vi.fn()}
          showRowNumbers={false}
          rowAppearance={[]}
          columnBackgrounds={new Map()}
          searchCurrent={null}
          isVirtualized={false}
          measureRow={undefined}
        />
      </TableBody>
    </Table>
  )

describe('Первый клик делает строку текущей, второй открывает правку (таблица 1С)', () => {
  it('невыделенная строка: клик по полю ввода не отдаёт ему фокус', () => {
    otrisovat({ selected: false, yacheyka: <input aria-label="ТМЗ" /> })

    const sobytie = fireEvent.mouseDown(screen.getByLabelText('ТМЗ'))

    // fireEvent возвращает false, если обработчик вызвал preventDefault.
    expect(sobytie).toBe(false)
  })

  it('выделенная строка: клик по полю ввода работает как обычно', () => {
    otrisovat({ selected: true, yacheyka: <input aria-label="ТМЗ" /> })

    expect(fireEvent.mouseDown(screen.getByLabelText('ТМЗ'))).toBe(true)
  })

  it('ячейка-ссылка открывается одним кликом даже в невыделенной строке (порт CellHyperlink)', () => {
    otrisovat({
      selected: false,
      yacheyka: (
        <button data-sdui-cell-hyperlink="true" type="button">
          Документ №1
        </button>
      ),
    })

    expect(fireEvent.mouseDown(screen.getByText('Документ №1'))).toBe(true)
  })

  it('обычный текст ячейки кликом не блокируется — выделять текст можно', () => {
    otrisovat({ selected: false, yacheyka: <span>Бумага А4</span> })

    expect(fireEvent.mouseDown(screen.getByText('Бумага А4'))).toBe(true)
  })
})

describe('Текущая строка видна: сплошная заливка и маркер слева', () => {
  it('выделенная строка получает собственный фон, а не дефолтные 8% MUI', () => {
    otrisovat({ selected: true, yacheyka: <span>Бумага А4</span> })

    const stroka = screen.getByText('Бумага А4').closest('tr')
    expect(stroka).not.toBeNull()
    expect(getComputedStyle(stroka as Element).backgroundColor).toBe(
      'var(--ui-08, #c4d6f5)'
    )
  })

  it('невыделенная строка фон не красит', () => {
    otrisovat({ selected: false, yacheyka: <span>Бумага А4</span> })

    const stroka = screen.getByText('Бумага А4').closest('tr')
    expect(getComputedStyle(stroka as Element).backgroundColor).not.toBe(
      'var(--ui-08, #c4d6f5)'
    )
  })
})
