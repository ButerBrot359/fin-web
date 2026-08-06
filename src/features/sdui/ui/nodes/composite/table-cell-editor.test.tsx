import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { TableCellEditor } from './table-cell-editor'

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
