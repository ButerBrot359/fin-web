// SCRUM-308 §4.1: дерево групп пользователей — фактический контракт
// (GroupTreeWireContractTest): selected/expanded только true и только на
// корне, у витринных узлов действий нет, недоступные несут tooltip.
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
const { dispatchMock } = vi.hoisted(() => ({ dispatchMock: vi.fn() }))
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => dispatchMock,
}))

import type { ViewNode } from '../../../types/view'
import { TreeNode } from './tree-node'

const wireTree = (): ViewNode =>
  ({
    id: 'list.Polzovateli.panel.gruppy.tree',
    type: 'TREE',
    children: [
      {
        id: 'list.Polzovateli.panel.gruppy.tree.node.vsePolzovateli',
        type: 'TREE_NODE',
        props: {
          label: 'Все пользователи',
          selected: true,
          expanded: true,
          enabled: true,
        },
        actions: null,
        children: [
          {
            id: 'list.Polzovateli.panel.gruppy.tree.node.10',
            type: 'TREE_NODE',
            props: {
              label: 'Бухгалтерия',
              enabled: false,
              tooltip: 'Отбор списка по группе пользователей не перенесён',
            },
            children: [],
          },
        ],
      },
    ],
  }) as unknown as ViewNode

describe('TREE / TREE_NODE (SCRUM-308 §4.1)', () => {
  afterEach(() => {
    cleanup()
    dispatchMock.mockReset()
  })

  it('корень выбран и раскрыт, дочерний узел виден', () => {
    render(<TreeNode node={wireTree()} />)
    const root = screen.getByRole('treeitem', { name: 'Все пользователи' })
    expect(root.getAttribute('aria-selected')).toBe('true')
    expect(root.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Бухгалтерия')).toBeTruthy()
  })

  it('узел без ключей selected/expanded не считается выбранным (строгие === true)', () => {
    render(<TreeNode node={wireTree()} />)
    const child = screen.getByRole('treeitem', { name: 'Бухгалтерия' })
    expect(child.getAttribute('aria-selected')).toBe('false')
  })

  it('клик по недоступному узлу без команды не диспатчит ничего', () => {
    render(<TreeNode node={wireTree()} />)
    fireEvent.click(screen.getByRole('treeitem', { name: 'Бухгалтерия' }))
    expect(dispatchMock).not.toHaveBeenCalled()
  })

  it('раскрыватель сворачивает и раскрывает ветку локально (состояние клиента)', () => {
    render(<TreeNode node={wireTree()} />)
    fireEvent.click(screen.getByRole('button', { name: 'table.collapseRow' }))
    expect(screen.queryByText('Бухгалтерия')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'table.expandRow' }))
    expect(screen.getByText('Бухгалтерия')).toBeTruthy()
  })

  it('узел с click-действием шлёт COMMAND с behavior', () => {
    const tree = wireTree()
    ;(
      tree.children![0] as unknown as {
        actions: unknown
        props: Record<string, unknown>
      }
    ).actions = [
      {
        trigger: 'click',
        actionId: 'command',
        command: 'tree.selectGroup',
        behavior: { flushPendingTables: false },
      },
    ]
    render(<TreeNode node={tree} />)
    fireEvent.click(screen.getByRole('treeitem', { name: 'Все пользователи' }))
    expect(dispatchMock).toHaveBeenCalledWith(
      {
        type: 'COMMAND',
        command: 'tree.selectGroup',
        value: { id: 'list.Polzovateli.panel.gruppy.tree.node.vsePolzovateli' },
        sourceNodeId: 'list.Polzovateli.panel.gruppy.tree.node.vsePolzovateli',
      },
      { flushPendingTables: false }
    )
  })
})
