import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import type { RelatedTreeRow } from '../../../types/related-docs'
import { useRelatedDocsStore } from '../../../lib/stores/related-docs-store'
import { TableNode } from './table-node'

const navigateMock = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

const state: Record<string, unknown> = {}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    getValue: (b?: string) => (b ? state[b] : undefined),
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: 'backend', init: () => undefined },
}))
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => vi.fn(),
}))

vi.mock('@/shared/assets/icons/doc-posted.svg', () => ({
  default: () => <span data-testid="icon-posted" />,
}))
vi.mock('@/shared/assets/icons/doc-draft.svg', () => ({
  default: () => <span data-testid="icon-draft" />,
}))
vi.mock('@/shared/assets/icons/doc-deleted.svg', () => ({
  default: () => <span data-testid="icon-deleted" />,
}))

const row = (over: Partial<RelatedTreeRow>): RelatedTreeRow => ({
  rowId: 'r1',
  _level: 0,
  _direction: 'SELF',
  _parentRowId: null,
  _isCurrent: false,
  _presentation: 'Документ',
  _isPosted: false,
  _isDeletionMarked: false,
  ...over,
})

const treeNode: ViewNode = {
  id: 'tbl.related',
  type: 'TABLE',
  binding: 'related.tree',
  props: { editable: false, rowMode: 'TREE', navigable: true, anchorId: 'a1' },
} as ViewNode

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  useRelatedDocsStore.getState().reset()
  delete state['related.tree']
})

describe('SubordinationTree', () => {
  it('отступ по _level, жирный по _isCurrent', () => {
    state['related.tree'] = [
      row({
        rowId: 'r1',
        _level: 2,
        _direction: 'UP',
        _presentation: 'Предок',
      }),
      row({
        rowId: 'r2',
        _level: 0,
        _isCurrent: true,
        _presentation: 'Текущий',
      }),
    ]
    render(<TableNode node={treeNode} />)
    const current = screen.getByText('Текущий')
    const ancestor = screen.getByText('Предок')
    expect(getComputedStyle(current).fontWeight).toBe('600')
    expect(getComputedStyle(ancestor).fontWeight).toBe('400')
    const ancestorCell = ancestor.closest('td')!
    const currentCell = current.closest('td')!
    expect(ancestorCell.style.paddingLeft).toBe('56px') // 8 + 2*24
    expect(currentCell.style.paddingLeft).toBe('8px')
  })

  it('иконка: _isDeletionMarked приоритетнее _isPosted, иначе draft', () => {
    state['related.tree'] = [
      row({ rowId: 'r1', _isPosted: true, _isDeletionMarked: true }),
      row({ rowId: 'r2', _isPosted: true, _presentation: 'Б' }),
      row({ rowId: 'r3', _presentation: 'В' }),
    ]
    render(<TableNode node={treeNode} />)
    expect(screen.getByTestId('icon-deleted')).toBeTruthy()
    expect(screen.getByTestId('icon-posted')).toBeTruthy()
    expect(screen.getByTestId('icon-draft')).toBeTruthy()
  })

  it('одиночный клик выделяет строку в сторе по anchorId', () => {
    state['related.tree'] = [row({ rowId: 'r1', _isDeletionMarked: true })]
    render(<TableNode node={treeNode} />)
    fireEvent.click(screen.getByText('Документ'))
    expect(useRelatedDocsStore.getState().selected.a1).toEqual({
      rowId: 'r1',
      isDeletionMarked: true,
    })
  })

  it('двойной клик навигирует по _route; фолбэк — entityRef', () => {
    state['related.tree'] = [
      row({ rowId: 'r1', _route: '/documents/SchetKOplate/1002' }),
      row({
        rowId: 'r2',
        _presentation: 'Без роута',
        _type: {
          entityRef: { domain: 'DOCUMENT', id: 7, typeCode: 'Zayavka' },
        },
      }),
    ]
    render(<TableNode node={treeNode} />)
    fireEvent.doubleClick(screen.getByText('Документ'))
    expect(navigateMock).toHaveBeenCalledWith('/documents/SchetKOplate/1002')
    fireEvent.doubleClick(screen.getByText('Без роута'))
    expect(navigateMock).toHaveBeenCalledWith('/documents/Zayavka/7')
  })

  it('_isTruncated: без иконки, клик не выделяет, dblclick не навигирует', () => {
    state['related.tree'] = [
      row({
        rowId: 'cut',
        _isTruncated: true,
        _presentation: '…ещё',
        _route: '/documents/X/1',
      }),
    ]
    render(<TableNode node={treeNode} />)
    const el = screen.getByText('…ещё')
    fireEvent.click(el)
    fireEvent.doubleClick(el)
    expect(useRelatedDocsStore.getState().selected.a1).toBeUndefined()
    expect(navigateMock).not.toHaveBeenCalled()
    expect(screen.queryByTestId('icon-draft')).toBeNull()
  })

  it('_status уходит в title строки', () => {
    state['related.tree'] = [row({ rowId: 'r1', _status: 'Проведён' })]
    render(<TableNode node={treeNode} />)
    expect(screen.getByTitle('Проведён')).toBeTruthy()
  })
})
