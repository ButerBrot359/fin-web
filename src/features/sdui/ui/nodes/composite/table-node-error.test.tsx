import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { TableNode } from './table-node'

vi.mock('./read-only-table', () => ({
  ReadOnlyTable: () => <div data-testid="read-only-table" />,
}))
vi.mock('./editable-table', () => ({ EditableTable: () => null }))
vi.mock('./complex-editable-table', () => ({
  ComplexEditableTable: () => null,
}))
vi.mock('./accounting-postings-block', () => ({
  AccountingPostingsBlock: () => null,
}))
vi.mock('./subordination-tree', () => ({ SubordinationTree: () => null }))
vi.mock('./kalendari-template-table', () => ({
  KalendariTemplateTable: () => null,
}))
vi.mock('./tabel/tabel-matrix-table', () => ({ TabelMatrixTable: () => null }))
vi.mock('./itogi-hierarchy-table', () => ({ ItogiHierarchyTable: () => null }))
vi.mock('./selection-list-table', () => ({ SelectionListTable: () => null }))

const tableNode = (props: Record<string, unknown>): ViewNode =>
  ({ id: 't1', type: 'TABLE', binding: 'TMZ', props }) as ViewNode

describe('TableNode: подсветка ТЧ по props.error', () => {
  afterEach(cleanup)

  it('текст ошибки показан рядом с таблицей', () => {
    render(
      <TableNode
        node={tableNode({
          error:
            'Не заполнено движение ТМЗ для номенклатуры 000000004 (строка 1).',
        })}
      />
    )
    expect(screen.getByTestId('read-only-table')).toBeTruthy()
    expect(
      screen.getByText(
        'Не заполнено движение ТМЗ для номенклатуры 000000004 (строка 1).'
      )
    ).toBeTruthy()
  })

  it('без ошибки таблица рендерится как прежде', () => {
    const { container } = render(<TableNode node={tableNode({})} />)
    expect(screen.getByTestId('read-only-table')).toBeTruthy()
    expect(container.querySelector('.MuiFormHelperText-root')).toBeNull()
  })

  it('скрытая таблица остаётся скрытой даже с ошибкой', () => {
    const { container } = render(
      <TableNode node={tableNode({ visible: false, error: 'ошибка' })} />
    )
    expect(container.innerHTML).toBe('')
  })
})
