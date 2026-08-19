import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { ButtonNode } from './button-node'

const dispatch = vi.fn()

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => dispatch,
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
  NodeRenderer: () => null,
}))

// SCRUM-362 B-4: бэк всегда явно проставляет enabled на BUTTON —
// фикстура отражает контракт, отдельные тесты могут переопределить.
const button = (props: Record<string, unknown>): ViewNode =>
  ({ id: 'b1', type: 'BUTTON', props: { enabled: true, ...props } }) as ViewNode

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
      />
    )
    expect(
      screen.getByRole('button', { name: 'Вывести иерархию' })
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
      />
    )
    fireEvent.mouseOver(screen.getByRole('button'))
    expect(await screen.findByRole('tooltip')).toBeTruthy()
  })

  it('регресс: label-кнопка рендерит текст и диспатчит команду', () => {
    render(<ButtonNode node={button({ label: 'Провести', command: 'post' })} />)
    const btn = screen.getByRole('button', { name: 'Провести' })
    fireEvent.click(btn)
    // behavior вторым аргументом; без actions/props.behavior → null
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'COMMAND', command: 'post' },
      null
    )
  })

  it('behavior из action.behavior прокидывается в dispatch (SCRUM-283)', () => {
    const node = {
      id: 'b1',
      type: 'BUTTON',
      props: { label: 'Провести', command: 'post', enabled: true },
      actions: [
        {
          trigger: 'click',
          actionId: 'command',
          behavior: { flushPendingTables: true, resetsDirty: true },
        },
      ],
    } as unknown as ViewNode
    render(<ButtonNode node={node} />)
    fireEvent.click(screen.getByRole('button', { name: 'Провести' }))
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'COMMAND', command: 'post' },
      { flushPendingTables: true, resetsDirty: true }
    )
  })

  it('props.behavior побеждает action.behavior (рантайм-override §2.5)', () => {
    const node = {
      id: 'b1',
      type: 'BUTTON',
      props: {
        label: 'Провести',
        command: 'post',
        enabled: true,
        behavior: { flushPendingTables: true, closeAfter: true },
      },
      actions: [
        {
          trigger: 'click',
          actionId: 'command',
          behavior: { flushPendingTables: false },
        },
      ],
    } as unknown as ViewNode
    render(<ButtonNode node={node} />)
    fireEvent.click(screen.getByRole('button', { name: 'Провести' }))
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'COMMAND', command: 'post' },
      { flushPendingTables: true, closeAfter: true }
    )
  })

  it('неизвестная иконка: fallback на label, svg нет', () => {
    const { container } = render(
      <ButtonNode node={button({ icon: 'nope', label: 'Метка' })} />
    )
    expect(screen.getByRole('button', { name: 'Метка' })).toBeTruthy()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('без label и без валидной иконки: fallback на command', () => {
    render(<ButtonNode node={button({ icon: 'nope', command: 'doIt' })} />)
    expect(screen.getByRole('button', { name: 'doIt' })).toBeTruthy()
  })

  it('без пропа enabled → кнопка disabled (строгий контракт SCRUM-362 B-4)', () => {
    const node = {
      id: 'b1',
      type: 'BUTTON',
      props: { label: 'Провести', command: 'post' },
    } as ViewNode
    render(<ButtonNode node={node} />)
    const btn = screen.getByRole('button', { name: 'Провести' })
    expect(btn.hasAttribute('disabled')).toBe(true)
    fireEvent.click(btn)
    expect(dispatch).not.toHaveBeenCalled()
  })
})
