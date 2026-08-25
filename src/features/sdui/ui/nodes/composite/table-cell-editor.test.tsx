import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { TableCellEditor } from './table-cell-editor'

// Настоящий пикер здесь не нужен (он покрыт в datetime-input.test.tsx) — важно,
// что колоночный props.dateFormat доезжает до редактора ячейки.
const dateEditorProps: { dateFormat?: string; dateOnly?: boolean } = {}
vi.mock('./date-cell-editor', () => ({
  DateCellEditor: (props: { dateFormat?: string; dateOnly?: boolean }) => {
    dateEditorProps.dateFormat = props.dateFormat
    dateEditorProps.dateOnly = props.dateOnly
    return <input data-testid="date-cell" />
  },
}))

const base = {
  cellWidget: 'TEXT_FIELD',
  dataType: 'STRING',
  onChange: vi.fn(),
  onCommit: vi.fn(),
}

// Рамка ошибки маркируется data-required-error="true" на обёртке
// (MUI sx → CSS-класс, инлайн-стиля outline в DOM нет — селектор по style не годится).
const ERR = '[data-required-error="true"]'

describe('TableCellEditor required validation', () => {
  it('пустая обязательная: до blur рамки нет, после blur — есть', () => {
    const { container } = render(
      <TableCellEditor {...base} value="" required />
    )
    expect(container.querySelector(ERR)).toBeNull()
    fireEvent.blur(container.querySelector('input')!)
    expect(container.querySelector(ERR)).toBeTruthy()
  })

  it('revealErrors подсвечивает пустую обязательную БЕЗ blur', () => {
    const { container } = render(
      <TableCellEditor {...base} value="" required revealErrors />
    )
    expect(container.querySelector(ERR)).toBeTruthy()
  })

  it('заполненная обязательная — без рамки даже после blur', () => {
    const { container } = render(
      <TableCellEditor {...base} value="x" required />
    )
    fireEvent.blur(container.querySelector('input')!)
    expect(container.querySelector(ERR)).toBeNull()
  })

  it('необязательная ячейка не оборачивается рамкой', () => {
    const { container } = render(<TableCellEditor {...base} value="" />)
    fireEvent.blur(container.querySelector('input')!)
    expect(container.querySelector(ERR)).toBeNull()
  })

  it('readonly обязательная — span без input и без рамки', () => {
    const { container } = render(
      <TableCellEditor {...base} value="" required readonly />
    )
    expect(container.querySelector('input')).toBeNull()
    expect(container.querySelector(ERR)).toBeNull()
  })
})

// props.dateFormat колонки ТЧ («Месяц начисления» — MM.yyyy).
describe('TableCellEditor — формат даты колонки', () => {
  const dateBase = {
    cellWidget: 'DATE_FIELD',
    dataType: 'DATE',
    value: '2026-08-12',
    onChange: vi.fn(),
    onCommit: vi.fn(),
  }

  it('формат доезжает до редактора ячейки', () => {
    render(<TableCellEditor {...dateBase} props={{ dateFormat: 'MM.yyyy' }} />)
    expect(dateEditorProps.dateFormat).toBe('MM.yyyy')
    expect(dateEditorProps.dateOnly).toBe(true)
  })

  it('без ключа редактор получает undefined — поведение прежнее', () => {
    render(<TableCellEditor {...dateBase} props={{}} />)
    expect(dateEditorProps.dateFormat).toBeUndefined()
  })

  // У readonly-ячейки редактора нет вовсе, но показывать в ней день так же
  // неверно, как и в редактируемой.
  it('readonly-ячейка показывает дату в формате колонки', () => {
    const { container } = render(
      <TableCellEditor
        {...dateBase}
        readonly
        props={{ dateFormat: 'MM.yyyy' }}
      />
    )
    expect(container.textContent).toBe('08.2026')
  })

  it('readonly-ячейка без ключа остаётся дд.ММ.гггг', () => {
    const { container } = render(
      <TableCellEditor {...dateBase} readonly props={{}} />
    )
    expect(container.textContent).toBe('12.08.2026')
  })
})

// Длинное readonly-значение («Доплата за квалификационную категорию 100%») не
// уходит одной строкой поверх соседней колонки, а переносится по её ширине.
describe('TableCellEditor — перенос текста readonly-значения', () => {
  it('readonly-значение переносится, а не идёт nowrap одной строкой', () => {
    const { container } = render(
      <TableCellEditor
        {...base}
        readonly
        value="Доплата за квалификационную категорию 100%"
      />
    )
    const span = container.querySelector('span')!
    expect(span.style.whiteSpace).toBe('normal')
    expect(span.style.overflowWrap).toBe('anywhere')
  })
})
