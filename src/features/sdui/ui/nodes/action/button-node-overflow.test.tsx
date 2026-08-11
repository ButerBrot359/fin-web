import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { OverflowContext } from '../../../lib/overflow/overflow-context'
import { ButtonNode } from './button-node'

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => vi.fn(),
}))

vi.mock('../../../lib/stores/selection-store', () => ({
  useSelection: () => null,
}))

vi.mock('../../../lib/use-sdui-effects', () => ({
  useSduiEffects: () => ({
    executeActionRequest: vi.fn(),
    play: vi.fn(),
    playAll: vi.fn(),
  }),
}))

vi.mock('../../node-renderer', () => ({
  NodeRenderer: ({ node }: { node: ViewNode }) => (
    <div>{(node.props?.label as string | undefined) ?? node.id}</div>
  ),
}))

afterEach(cleanup)

describe('ButtonNode: overflow-секция в меню «Ещё» (SCRUM-265 FE-5)', () => {
  it('btn.more показывает свёрнутые узлы отдельной секцией перед штатными пунктами', () => {
    const moreNode = {
      id: 'btn.more',
      type: 'BUTTON',
      props: { label: 'Ещё', variant: 'dropdown' },
      children: [
        {
          id: 'mi.more.x',
          type: 'MENU_ITEM',
          props: { label: 'Штатный пункт', command: 'x' },
        },
      ],
    } as unknown as ViewNode
    const collapsed = [
      {
        id: 'btn.reports',
        type: 'BUTTON',
        props: { label: 'Отчеты', command: 'reports' },
      },
    ] as unknown as ViewNode[]

    render(
      <OverflowContext.Provider value={{ collapsedNodes: collapsed }}>
        <ButtonNode node={moreNode} />
      </OverflowContext.Provider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ещё' }))

    expect(screen.getByText('Отчеты')).toBeTruthy()
    expect(screen.getByText('Штатный пункт')).toBeTruthy()
  })

  it('не-btn.more кнопка игнорирует контекст (default пустой)', () => {
    const node = {
      id: 'btn.other',
      type: 'BUTTON',
      props: { label: 'Другое', variant: 'dropdown' },
      children: [
        {
          id: 'mi.other.x',
          type: 'MENU_ITEM',
          props: { label: 'Пункт', command: 'x' },
        },
      ],
    } as unknown as ViewNode
    const collapsed = [
      {
        id: 'btn.reports',
        type: 'BUTTON',
        props: { label: 'Отчеты', command: 'reports' },
      },
    ] as unknown as ViewNode[]

    render(
      <OverflowContext.Provider value={{ collapsedNodes: collapsed }}>
        <ButtonNode node={node} />
      </OverflowContext.Provider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Другое' }))

    expect(screen.queryByText('Отчеты')).toBeNull()
    expect(screen.getByText('Пункт')).toBeTruthy()
  })
})
