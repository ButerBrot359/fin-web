import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { ButtonNode } from './button-node'

const dispatch = vi.fn()

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => dispatch,
}))

vi.mock('../../../lib/stores/ref-picker-selection-store', () => ({
  needsSelectedRow: () => false,
  refCommandField: () => null,
  useRefPickerSelection: () => null,
}))

vi.mock('../../node-renderer', () => ({
  NodeRenderer: () => null,
}))

const button = (props: Record<string, unknown>): ViewNode =>
  ({ id: 'b1', type: 'BUTTON', props }) as ViewNode

describe('ButtonNode: icon и tooltip', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('icon-only: inline svg, accessible name = tooltip', () => {
    const { container } = render(
      <ButtonNode
        node={button({
          command: 'showRelatedDocuments',
          icon: 'related-hierarchy',
          tooltip: 'Вывести иерархию',
        })}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Вывести иерархию' }),
    ).toBeTruthy()
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('hover по кнопке с tooltip показывает role="tooltip"', async () => {
    render(
      <ButtonNode
        node={button({
          command: 'showRelatedDocuments',
          icon: 'related-hierarchy',
          tooltip: 'Вывести иерархию',
        })}
      />,
    )
    fireEvent.mouseOver(screen.getByRole('button'))
    expect(await screen.findByRole('tooltip')).toBeTruthy()
  })

  it('регресс: label-кнопка рендерит текст и диспатчит команду', () => {
    render(<ButtonNode node={button({ label: 'Провести', command: 'post' })} />)
    const btn = screen.getByRole('button', { name: 'Провести' })
    fireEvent.click(btn)
    expect(dispatch).toHaveBeenCalledWith({ type: 'COMMAND', command: 'post' })
  })

  it('неизвестная иконка: fallback на label, svg нет', () => {
    const { container } = render(
      <ButtonNode node={button({ icon: 'nope', label: 'Метка' })} />,
    )
    expect(screen.getByRole('button', { name: 'Метка' })).toBeTruthy()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('без label и без валидной иконки: fallback на command', () => {
    render(<ButtonNode node={button({ icon: 'nope', command: 'doIt' })} />)
    expect(screen.getByRole('button', { name: 'doIt' })).toBeTruthy()
  })
})
