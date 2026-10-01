import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { HStackNode } from './hstack-node'

vi.mock('../../node-renderer', () => ({
  NodeRenderer: ({ node }: { node: ViewNode }) => (
    <span data-testid={node.id} />
  ),
}))

const child = (id: string, flex?: number | string): ViewNode =>
  ({ id, type: 'TABLE', props: flex !== undefined ? { flex } : {} }) as ViewNode

describe('HStackNode', () => {
  it('оборачивает детей в контейнеры flex:1 minWidth:0 (равное деление)', () => {
    const node = {
      id: 'h1',
      type: 'HSTACK',
      props: {},
      children: [child('t1'), child('t2')],
    } as ViewNode
    const { getByTestId } = render(<HStackNode node={node} />)
    const wrapper = getByTestId('t1').parentElement!
    expect(wrapper.style.flex).toBe('1 1 0%')
    expect(wrapper.style.minWidth).toBe('0px')
    const wrapper2 = getByTestId('t2').parentElement!
    expect(wrapper2.style.flex).toBe('1 1 0%')
  })

  it('уважает props.flex ребёнка, если задан', () => {
    const node = {
      id: 'h2',
      type: 'HSTACK',
      props: {},
      children: [child('t3', 2), child('t4')],
    } as ViewNode
    const { getByTestId } = render(<HStackNode node={node} />)
    const wrapper = getByTestId('t3').parentElement!
    expect(wrapper.style.flexGrow).toBe('2')
  })

  // Цепочка высоты растянутой карточки («Начисление зарплаты»): без сжимаемости
  // строка вырастает на всю высоту ТЧ, таблица теряет собственную прокрутку, и
  // её горизонтальная полоса оказывается ниже кромки экрана.
  it('растянутая строка сжимается ниже содержимого (minHeight: 0)', () => {
    const node = {
      id: 'h4',
      type: 'HSTACK',
      props: { flex: 1 },
      children: [child('t7')],
    } as ViewNode
    const { container } = render(<HStackNode node={node} />)
    const row = container.firstElementChild as HTMLElement
    expect(row.style.flex).toBe('1 1 0%')
    expect(row.style.minHeight).toBe('0px')
  })

  it('строка без flex остаётся высотой по содержимому', () => {
    const node = {
      id: 'h5',
      type: 'HSTACK',
      props: {},
      children: [child('t8')],
    } as ViewNode
    const { container } = render(<HStackNode node={node} />)
    expect((container.firstElementChild as HTMLElement).style.minHeight).toBe(
      ''
    )
  })

  it('колонка тоже сжимаема по высоте — иначе таблица распирает строку', () => {
    const node = {
      id: 'h6',
      type: 'HSTACK',
      props: { flex: 1 },
      children: [child('t9')],
    } as ViewNode
    const { getByTestId } = render(<HStackNode node={node} />)
    expect(getByTestId('t9').parentElement!.style.minHeight).toBe('0px')
  })

  it('скрытый ребёнок не оставляет пустую flex-колонку', () => {
    const hidden = {
      id: 't6',
      type: 'TABLE',
      props: { visible: false },
    } as ViewNode
    const node = {
      id: 'h3',
      type: 'HSTACK',
      props: {},
      children: [child('t5'), hidden],
    } as ViewNode
    const { container, queryByTestId } = render(<HStackNode node={node} />)
    expect(queryByTestId('t6')).toBeNull()
    expect(container.firstElementChild?.children).toHaveLength(1)
  })
})
