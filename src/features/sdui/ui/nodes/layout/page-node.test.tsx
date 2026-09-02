import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { PageNode } from './page-node'

vi.mock('../../node-renderer', () => ({
  NodeRenderer: ({ node }: { node: ViewNode }) => (
    <div data-testid={`node-${node.type}`} />
  ),
}))
vi.mock('../composite/list-output-dialog', () => ({
  ListOutputDialog: () => <div data-testid="list-output-dialog" />,
}))

const page = (
  children: ViewNode[],
  props: Record<string, unknown> = {}
): ViewNode => ({ id: 'page', type: 'PAGE', props, children }) as ViewNode

const child = (type: string): ViewNode =>
  ({ id: `n.${type}`, type }) as ViewNode

/**
 * Высота экрана списка: страница обязана отдать таблице всю оставшуюся высоту, иначе
 * таблица не получает собственной прокрутки, а подвал (счётчик загруженных строк и
 * «Выгрузить в Excel») уезжает в самый конец списка вместо места под таблицей — так было
 * до 02.09.2026, тогда как на легаси-экранах подвал стоит вне таблицы и виден всегда.
 */
describe('PageNode', () => {
  afterEach(cleanup)

  it('страница со списком тянется на всю высоту (min-h-0 flex-1)', () => {
    const { container } = render(
      <PageNode node={page([child('TOOLBAR'), child('LIST')])} />
    )

    const root = container.firstElementChild
    expect(root?.className).toContain('flex-1')
    expect(root?.className).toContain('min-h-0')
  })

  it('карточка высоту не тянет — её содержимое прокручивается страницей', () => {
    const { container } = render(
      <PageNode node={page([child('TOOLBAR'), child('TABS')])} />
    )

    const root = container.firstElementChild
    expect(root?.className).not.toContain('flex-1')
  })

  it('диалог «Вывести список» рисуется своим телом, а не детьми', () => {
    render(<PageNode node={page([], { kind: 'LIST_OUTPUT_DIALOG' })} />)

    expect(screen.getByTestId('list-output-dialog')).toBeTruthy()
  })

  it('обычная страница рендерит детей', () => {
    render(<PageNode node={page([child('TOOLBAR'), child('LIST')])} />)

    expect(screen.getByTestId('node-TOOLBAR')).toBeTruthy()
    expect(screen.getByTestId('node-LIST')).toBeTruthy()
  })
})
