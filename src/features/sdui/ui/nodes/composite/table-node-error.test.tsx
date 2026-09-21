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

describe('TableNode: подсветка ТЧ по props.error (SCRUM-317 v4 §4.1)', () => {
  afterEach(cleanup)

  it('ошибка → таблица обведена рамкой, ТЕКСТА ошибки под ней нет (живёт в панели)', () => {
    render(
      <TableNode
        node={tableNode({
          error:
            'Не заполнено движение ТМЗ для номенклатуры 000000004 (строка 1).',
        })}
      />
    )
    expect(screen.getByTestId('read-only-table')).toBeTruthy()
    expect(screen.getByTestId('table-error-frame')).toBeTruthy()
    expect(
      screen.queryByText(
        'Не заполнено движение ТМЗ для номенклатуры 000000004 (строка 1).'
      )
    ).toBeNull()
  })

  it('без ошибки таблица рендерится как прежде — без рамки', () => {
    render(<TableNode node={tableNode({})} />)
    expect(screen.getByTestId('read-only-table')).toBeTruthy()
    expect(screen.queryByTestId('table-error-frame')).toBeNull()
  })

  it('скрытая таблица остаётся скрытой даже с ошибкой', () => {
    const { container } = render(
      <TableNode node={tableNode({ visible: false, error: 'ошибка' })} />
    )
    expect(container.innerHTML).toBe('')
  })
})
