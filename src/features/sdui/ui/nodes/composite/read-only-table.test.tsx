import { render, screen, cleanup } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { TableNode } from './table-node'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: 'backend', init: () => {} },
}))

const state: Record<string, unknown> = {}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    getValue: (b?: string) => (b ? state[b] : undefined),
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => vi.fn(),
}))

const makeTable = (props: Record<string, unknown>): ViewNode =>
  ({
    id: 'tbl',
    type: 'TABLE',
    binding: 'rows',
    props: { editable: false, ...props },
    children: [
      { id: 'c.a', type: 'TABLE_COLUMN', binding: 'a', props: { label: 'A' } },
    ],
  }) as ViewNode

beforeEach(() => {
  cleanup()
  delete state.rows
})

describe('ReadOnlyTable showRowNumbers', () => {
  it('с флагом рендерит ведущую колонку N со значениями 1..n', () => {
    state.rows = [
      { rowId: 'r1', a: 'x' },
      { rowId: 'r2', a: 'y' },
    ]
    render(<TableNode node={makeTable({ showRowNumbers: true })} />)
    expect(screen.getByText('table.rowNumber')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('без флага колонки N нет', () => {
    state.rows = [{ rowId: 'r1', a: 'x' }]
    render(<TableNode node={makeTable({})} />)
    expect(screen.queryByText('table.rowNumber')).toBeNull()
  })
})
