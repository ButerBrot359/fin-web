import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { applyPatches } from '../../../lib/patch-applier'
import { GroupNode } from './group-node'

vi.mock('../../node-renderer', () => ({
  NodeRenderer: ({ node }: { node: ViewNode }) => <span>{node.id}</span>,
}))

// globals в vitest.config выключены — авточистки DOM между тестами нет.
beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** Домотать 300ms-анимацию MUI Collapse до конечного состояния. */
const settle = () => {
  act(() => {
    vi.advanceTimersByTime(500)
  })
}

const group = (collapsed?: boolean): ViewNode =>
  ({
    id: 'group.params',
    type: 'GROUP',
    props: {
      title: 'Параметры',
      collapsible: true,
      ...(collapsed === undefined ? {} : { collapsed }),
    },
    children: [{ id: 'field.period', type: 'DATE_FIELD' }],
  }) as ViewNode

/** MuiCollapse-entered висит ровно на раскрытой группе (после settle()). */
const isCollapsed = (container: HTMLElement) => {
  settle()
  return (
    container
      .querySelector('.MuiCollapse-root')
      ?.classList.contains('MuiCollapse-entered') === false
  )
}

const toggle = (container: HTMLElement) => {
  fireEvent.click(container.querySelector('button')!)
}

describe('GroupNode / отступы между детьми', () => {
  const withGap = (gap?: number): ViewNode =>
    ({
      id: 'group.avans',
      type: 'GROUP',
      props: { title: 'Аванс:', ...(gap === undefined ? {} : { gap }) },
      children: [
        { id: 'field.protsentAvansa', type: 'NUMBER_FIELD' },
        { id: 'field.summaAvansa', type: 'NUMBER_FIELD' },
      ],
    }) as ViewNode

  /** Флекс-обёртка детей, которую ставит только ветка с gap. */
  const gapBox = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('.MuiCollapse-root div[style*="gap"]')

  it('gap: 3 даёт тот же шаг 4px, что и у VSTACK', () => {
    const { container } = render(<GroupNode node={withGap(3)} />)
    expect(gapBox(container)?.style.gap).toBe('12px')
  })

  it('без gap раскладка детей прежняя — лишней обёртки нет', () => {
    const { container } = render(<GroupNode node={withGap()} />)
    expect(gapBox(container)).toBeNull()
  })

  it('дети рендерятся в обоих вариантах', () => {
    const { container: withBox } = render(<GroupNode node={withGap(3)} />)
    const { container: plain } = render(<GroupNode node={withGap()} />)
    for (const c of [withBox, plain]) {
      expect(c.textContent).toContain('field.protsentAvansa')
      expect(c.textContent).toContain('field.summaAvansa')
    }
  })
})

describe('GroupNode / сворачивание', () => {
  it('collapsed из стартового дерева применяется', () => {
    const { container } = render(<GroupNode node={group(true)} />)
    expect(isCollapsed(container)).toBe(true)
  })

  it('без пропа группа развёрнута', () => {
    const { container } = render(<GroupNode node={group()} />)
    expect(isCollapsed(container)).toBe(false)
  })

  it('пользователь сворачивает и разворачивает руками', () => {
    const { container } = render(<GroupNode node={group()} />)
    toggle(container)
    expect(isCollapsed(container)).toBe(true)
    expect(
      container.querySelector('[data-testid="ExpandMoreIcon"]')
    ).toBeTruthy()
    toggle(container)
    expect(isCollapsed(container)).toBe(false)
    expect(
      container.querySelector('[data-testid="ExpandLessIcon"]')
    ).toBeTruthy()
  })

  it('рантайм-патч setProp collapsed=true сворачивает уже смонтированную группу', () => {
    const node = group(false)
    const { container, rerender } = render(<GroupNode node={node} />)
    expect(isCollapsed(container)).toBe(false)

    const patched = applyPatches(node, [
      { op: 'setProp', nodeId: 'group.params', key: 'collapsed', value: true },
    ])
    rerender(<GroupNode node={patched} />)

    expect(isCollapsed(container)).toBe(true)
  })

  it('повторная команда сворачивает группу, развёрнутую руками после первой', () => {
    let node = group(false)
    const { container, rerender } = render(<GroupNode node={node} />)

    // «Сформировать» → группа параметров схлопнулась.
    node = applyPatches(node, [
      { op: 'setProp', nodeId: 'group.params', key: 'collapsed', value: true },
    ])
    rerender(<GroupNode node={node} />)
    expect(isCollapsed(container)).toBe(true)

    // Пользователь развернул её обратно, чтобы поправить параметры.
    toggle(container)
    expect(isCollapsed(container)).toBe(false)

    // «Сформировать» ещё раз — значение то же самое, схлопнуть обязано снова.
    node = applyPatches(node, [
      { op: 'setProp', nodeId: 'group.params', key: 'collapsed', value: true },
    ])
    rerender(<GroupNode node={node} />)
    expect(isCollapsed(container)).toBe(true)
  })

  it('патч в соседний проп группы не отменяет ручное сворачивание', () => {
    let node = group(false)
    const { container, rerender } = render(<GroupNode node={node} />)

    node = applyPatches(node, [
      { op: 'setProp', nodeId: 'group.params', key: 'title', value: 'Отбор' },
    ])
    rerender(<GroupNode node={node} />)
    toggle(container)
    expect(isCollapsed(container)).toBe(true)
  })

  // «Сбросить» в отчёте подменяет группу параметров целиком, и пересобранный
  // узел не несёт collapsed вовсе. Здесь GroupNode остаётся тем же React-инстансом
  // (id в дереве не меняется, перемонтирования нет) — то есть проверяется худший
  // случай: состояние обязано слететь и без размонтирования.
  it('replaceNode без collapsed разворачивает группу, схлопнутую патчем', () => {
    let node = group(false)
    const { container, rerender } = render(<GroupNode node={node} />)

    node = applyPatches(node, [
      { op: 'setProp', nodeId: 'group.params', key: 'collapsed', value: true },
    ])
    rerender(<GroupNode node={node} />)
    expect(isCollapsed(container)).toBe(true)

    node = applyPatches(node, [
      { op: 'replaceNode', nodeId: 'group.params', node: group() },
    ])
    rerender(<GroupNode node={node} />)

    expect(isCollapsed(container)).toBe(false)
  })

  it('replaceNode без collapsed разворачивает группу, схлопнутую руками', () => {
    let node = group(false)
    const { container, rerender } = render(<GroupNode node={node} />)
    toggle(container)
    expect(isCollapsed(container)).toBe(true)

    node = applyPatches(node, [
      { op: 'replaceNode', nodeId: 'group.params', node: group() },
    ])
    rerender(<GroupNode node={node} />)

    expect(isCollapsed(container)).toBe(false)
  })

  it('патч в дочерний узел не трогает состояние группы', () => {
    let node = group(false)
    const { container, rerender } = render(<GroupNode node={node} />)
    toggle(container)
    expect(isCollapsed(container)).toBe(true)

    // Предку пересобираются только children — props остаются той же ссылкой,
    // поэтому ручной выбор пользователя переживает патчи в поддерево.
    node = applyPatches(node, [
      { op: 'setProp', nodeId: 'field.period', key: 'enabled', value: false },
    ])
    rerender(<GroupNode node={node} />)

    expect(isCollapsed(container)).toBe(true)
  })
})
