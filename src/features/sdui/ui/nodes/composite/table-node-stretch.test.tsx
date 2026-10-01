import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'

vi.mock('./editable-table', () => ({
  EditableTable: () => <div data-testid="editable-table" />,
}))

import { TableNode } from './table-node'

afterEach(cleanup)

const node = (props: Record<string, unknown>): ViewNode =>
  ({
    id: 'table.vakansii',
    type: 'TABLE',
    binding: 'Vakansii',
    props: { editable: true, ...props },
    children: [],
  }) as unknown as ViewNode

describe('растяжка табличной части по props.flex', () => {
  it('с props.flex таблица становится растягивающейся колонкой с полом высоты', () => {
    render(<TableNode node={node({ flex: 1 })} />)

    const obertka = screen.getByTestId('editable-table').parentElement
    expect(obertka?.dataset.stretch).toBe('true')
    expect(obertka?.style.flexDirection).toBe('column')
    expect(obertka?.style.flex).toBe('1 1 0%')
    expect(obertka?.style.minHeight).toBe('288px')
  })

  it('с props.flex рамка ошибки остаётся внутри растягивающейся колонки', () => {
    render(<TableNode node={node({ flex: 1, error: 'Не заполнено' })} />)

    const ramka = screen.getByTestId('table-error-frame')
    expect(ramka.parentElement?.dataset.stretch).toBe('true')
  })

  it('без пропа таблица остаётся высотой по содержимому', () => {
    const { container } = render(<TableNode node={node({})} />)

    expect(container.querySelector('[data-stretch]')).toBeNull()
    expect(screen.getByTestId('editable-table').parentElement).toBe(container)
  })

  it('невидимая таблица с props.flex не оставляет пустой растянутой колонки', () => {
    const { container } = render(
      <TableNode node={node({ flex: 1, visible: false })} />
    )

    expect(container.innerHTML).toBe('')
  })
})
