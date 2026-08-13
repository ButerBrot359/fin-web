import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import type { RelatedTreeRow } from '../../../types/related-docs'
import {
  useSelection,
  useSelectionStore,
} from '../../../lib/stores/selection-store'
import { TableNode } from './table-node'

vi.mock('../../../lib/stores/selection-store', () => ({
  useSelectionStore: vi.fn(),
  useSelection: vi.fn(),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

const armNewTabMock = vi.fn()
vi.mock('../../../lib/workspace-tab-gateway', () => ({
  armNewTab: () => {
    armNewTabMock()
    return false
  },
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

const baseProps = {
  editable: false,
  rowMode: 'TREE',
  navigable: true,
  anchorId: 'a1',
}

// Узел с select-действием (флаг включён) — пишет выделение в объединённый стор по selectionField.
const treeNodeWithSelectAction = (field: string): ViewNode =>
  ({
    id: 'tbl.related',
    type: 'TABLE',
    binding: 'related.tree',
    props: baseProps,
    actions: [{ trigger: 'select', actionId: 'select', selectionField: field }],
  }) as ViewNode

// Узел без select-действия (флаг выключён) — старый путь мёртв, клики ничего не пишут.
const treeNodeNoActions: ViewNode = {
  id: 'tbl.related',
  type: 'TABLE',
  binding: 'related.tree',
  props: baseProps,
} as ViewNode

let setSelectionMock: ReturnType<
  typeof vi.fn<(field: string, id: string | number | null) => void>
>
let clearSelectionMock: ReturnType<typeof vi.fn<(field: string) => void>>

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  delete state['related.tree']
  setSelectionMock = vi.fn()
  clearSelectionMock = vi.fn()
  vi.mocked(useSelectionStore).mockImplementation((selector) =>
    selector({
      selection: {},
      setSelection: setSelectionMock,
      clearSelection: clearSelectionMock,
    })
  )
  vi.mocked(useSelection).mockReturnValue(null)
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
    render(<TableNode node={treeNodeNoActions} />)
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
    render(<TableNode node={treeNodeNoActions} />)
    expect(screen.getByTestId('icon-deleted')).toBeTruthy()
    expect(screen.getByTestId('icon-posted')).toBeTruthy()
    expect(screen.getByTestId('icon-draft')).toBeTruthy()
  })

  it('клик по строке пишет rowId в объединённый стор по selectionField (флаг вкл)', () => {
    state['related.tree'] = [row({ rowId: 'r1', _presentation: 'Документ №1' })]
    render(<TableNode node={treeNodeWithSelectAction('related.a1')} />)
    fireEvent.click(screen.getByText('Документ №1'))
    expect(setSelectionMock).toHaveBeenCalledWith('related.a1', 'r1')
  })

  it('без select-действия (флаг выкл) — клик не пишет в стор (старый путь не ломаем)', () => {
    state['related.tree'] = [row({ rowId: 'r1' })]
    render(<TableNode node={treeNodeNoActions} />)
    fireEvent.click(screen.getByText('Документ'))
    expect(setSelectionMock).not.toHaveBeenCalled()
  })

  it('строка подсвечивается selected, когда selectedId совпадает с rowId', () => {
    vi.mocked(useSelection).mockReturnValue('r1')
    state['related.tree'] = [row({ rowId: 'r1' })]
    render(<TableNode node={treeNodeWithSelectAction('related.a1')} />)
    const tr = screen.getByText('Документ').closest('tr')!
    expect(tr.className).toContain('Mui-selected')
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
    render(<TableNode node={treeNodeNoActions} />)
    fireEvent.doubleClick(screen.getByText('Документ'))
    expect(navigateMock).toHaveBeenCalledWith('/documents/SchetKOplate/1002')
    fireEvent.doubleClick(screen.getByText('Без роута'))
    expect(navigateMock).toHaveBeenCalledWith('/documents/Zayavka/7')
    expect(armNewTabMock).toHaveBeenCalledTimes(2)
  })

  it('двойной клик армит новую workspace-вкладку через gateway (спека v2)', () => {
    state['related.tree'] = [
      row({ rowId: 'r1', _route: '/documents/SchetKOplate/1002' }),
    ]
    render(<TableNode node={treeNodeNoActions} />)
    fireEvent.doubleClick(screen.getByText('Документ'))
    expect(armNewTabMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/documents/SchetKOplate/1002')
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
    render(<TableNode node={treeNodeWithSelectAction('related.a1')} />)
    const el = screen.getByText('…ещё')
    fireEvent.click(el)
    fireEvent.doubleClick(el)
    expect(setSelectionMock).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
    expect(armNewTabMock).not.toHaveBeenCalled()
    expect(screen.queryByTestId('icon-draft')).toBeNull()
  })

  it('_status уходит в title строки', () => {
    state['related.tree'] = [row({ rowId: 'r1', _status: 'Проведён' })]
    render(<TableNode node={treeNodeNoActions} />)
    expect(screen.getByTitle('Проведён')).toBeTruthy()
  })

  it('после перестроения дерева выделение снимается, если строка пропала из rows', () => {
    vi.mocked(useSelection).mockReturnValue('r1')
    state['related.tree'] = [row({ rowId: 'r2', _presentation: 'Другой' })]
    render(<TableNode node={treeNodeWithSelectAction('related.a1')} />)
    expect(clearSelectionMock).toHaveBeenCalledWith('related.a1')
  })
})
