import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { MenuItemNode } from './menu-item-node'

const dispatch = vi.fn()

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => dispatch,
}))

const item = (props: Record<string, unknown>): ViewNode =>
  ({ id: 'mi1', type: 'MENU_ITEM', props }) as ViewNode

describe('MenuItemNode: enabled/disabled (SCRUM-265 FE-2)', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('enabled-пункт диспатчит команду по клику', () => {
    render(<MenuItemNode node={item({ label: 'Заполнить', command: 'zapolnit' })} />)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Заполнить' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'COMMAND', command: 'zapolnit' }, null)
  })

  it('enabled:false → пункт disabled и НЕ диспатчит', () => {
    render(
      <MenuItemNode
        node={item({ label: 'Заполнить', command: 'zapolnit', enabled: false })}
      />,
    )
    const mi = screen.getByRole('menuitem', { name: 'Заполнить' })
    expect(mi.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(mi)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('tooltip на disabled-пункте показывается при hover (span-обёртка)', async () => {
    render(
      <MenuItemNode
        node={item({
          label: 'Заполнить',
          command: 'zapolnit',
          enabled: false,
          tooltip: 'В разработке',
        })}
      />,
    )
    fireEvent.mouseOver(screen.getByText('Заполнить'))
    expect(await screen.findByRole('tooltip')).toBeTruthy()
  })
})
