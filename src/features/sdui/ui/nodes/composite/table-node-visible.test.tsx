import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'

vi.mock('./editable-table', () => ({
  EditableTable: () => <div data-testid="editable-table" />,
}))
vi.mock('./complex-editable-table', () => ({
  ComplexEditableTable: () => <div data-testid="complex-editable-table" />,
}))
vi.mock('./accounting-postings-block', () => ({
  AccountingPostingsBlock: () => <div data-testid="postings-block" />,
}))
vi.mock('./read-only-table', () => ({
  ReadOnlyTable: () => <div data-testid="read-only-table" />,
}))
vi.mock('./subordination-tree', () => ({
  SubordinationTree: () => <div data-testid="subordination-tree" />,
}))
vi.mock('./kalendari-template-table', () => ({
  KalendariTemplateTable: () => <div data-testid="kalendari-table" />,
}))
vi.mock('./tabel/tabel-matrix-table', () => ({
  TabelMatrixTable: () => <div data-testid="tabel-matrix" />,
}))

import { TableNode } from './table-node'

afterEach(cleanup)

// SCRUM-70 §2: невидимая таблица ≠ пустая таблица — чек-лист ограничения
// пользователя скрыт, пока гейт-флаг выключен.
const node = (props: Record<string, unknown> = {}): ViewNode =>
  ({
    id: 'dict.field.DostupnyePodrazdeleniya',
    type: 'TABLE',
    binding: 'DostupnyePodrazdeleniya',
    props,
    children: [],
  }) as unknown as ViewNode

describe('TableNode props.visible (SCRUM-70)', () => {
  it('visible: false — таблица не рендерится вовсе', () => {
    const { container } = render(<TableNode node={node({ visible: false })} />)
    expect(container.innerHTML).toBe('')
  })

  it('visible: true — рендер как раньше', () => {
    render(<TableNode node={node({ visible: true })} />)
    expect(screen.getByTestId('read-only-table')).toBeTruthy()
  })

  it('пропа нет — рендер как раньше (обратная совместимость)', () => {
    render(<TableNode node={node()} />)
    expect(screen.getByTestId('read-only-table')).toBeTruthy()
  })

  it('гейт действует и на редактируемый вариант', () => {
    const { container } = render(
      <TableNode node={node({ visible: false, editable: true })} />
    )
    expect(container.innerHTML).toBe('')
  })
})

// SCRUM-363: потоковый ввод живёт в ComplexEditableTable — плоская редактируемая
// таблица с autoAdvance:true уходит туда, без флага — остаётся на обычной ветке.
describe('TableNode props.autoAdvance (SCRUM-363)', () => {
  it('editable + autoAdvance:true → ComplexEditableTable', () => {
    render(<TableNode node={node({ editable: true, autoAdvance: true })} />)
    expect(screen.getByTestId('complex-editable-table')).toBeTruthy()
  })

  it('editable без флага → обычная EditableTable', () => {
    render(<TableNode node={node({ editable: true })} />)
    expect(screen.getByTestId('editable-table')).toBeTruthy()
  })
})
