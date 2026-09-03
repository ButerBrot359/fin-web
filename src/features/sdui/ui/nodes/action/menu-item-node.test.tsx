import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { useSelectionStore } from '../../../lib/stores/selection-store'
import { MenuCloseContext } from './menu-close-context'
import { MenuItemNode } from './menu-item-node'

const dispatch = vi.fn()
const executeActionRequest = vi.fn()

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => dispatch,
}))
vi.mock('../../../lib/use-sdui-effects', () => ({
  useSduiEffects: () => ({ executeActionRequest }),
}))

const item = (
  props: Record<string, unknown>,
  actions?: ViewNode['actions']
): ViewNode => ({ id: 'mi1', type: 'MENU_ITEM', props, actions }) as ViewNode

describe('MenuItemNode: enabled/disabled (SCRUM-265 FE-2)', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('enabled:true → пункт диспатчит команду по клику', () => {
    render(
      <MenuItemNode
        node={item({ label: 'Заполнить', command: 'zapolnit', enabled: true })}
      />
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Заполнить' }))
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'COMMAND', command: 'zapolnit' },
      null
    )
  })

  it('без пропа enabled → пункт disabled (строгий контракт SCRUM-362 B-4)', () => {
    render(
      <MenuItemNode node={item({ label: 'Заполнить', command: 'zapolnit' })} />
    )
    const mi = screen.getByRole('menuitem', { name: 'Заполнить' })
    expect(mi.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(mi)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('enabled:false → пункт disabled и НЕ диспатчит', () => {
    render(
      <MenuItemNode
        node={item({ label: 'Заполнить', command: 'zapolnit', enabled: false })}
      />
    )
    const mi = screen.getByRole('menuitem', { name: 'Заполнить' })
    expect(mi.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(mi)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('request на click-действии → executeActionRequest, command НЕ диспатчится (SCRUM-277 §13.12)', () => {
    const request = {
      method: 'POST' as const,
      url: '/api/view/production-calendar/classifier-picker/panel',
      body: { formSessionId: 'fs-1' },
    }
    render(
      <MenuItemNode
        node={item({ label: 'По классификатору...', enabled: true }, [
          { trigger: 'click', actionId: 'request', request },
        ])}
      />
    )
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'По классификатору...' })
    )
    expect(executeActionRequest).toHaveBeenCalledWith(request)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('request побеждает command в одной ветке клика', () => {
    const request = { method: 'POST' as const, url: '/x', body: null }
    render(
      <MenuItemNode
        node={item({ label: 'Пункт', command: 'cmd', enabled: true }, [
          { trigger: 'click', actionId: 'request', request },
        ])}
      />
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Пункт' }))
    expect(executeActionRequest).toHaveBeenCalledWith(request)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('активация пункта закрывает меню через MenuCloseContext ДО confirm (SCRUM-276 §6)', () => {
    const closeMenu = vi.fn()
    render(
      <MenuCloseContext.Provider value={closeMenu}>
        <MenuItemNode
          node={item({
            label: 'Заполнить',
            command: 'zapolnit',
            enabled: true,
          })}
        />
      </MenuCloseContext.Provider>
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Заполнить' }))
    expect(closeMenu).toHaveBeenCalled()
    expect(dispatch).toHaveBeenCalled()
  })

  it('клик по disabled-пункту меню НЕ закрывает', () => {
    const closeMenu = vi.fn()
    render(
      <MenuCloseContext.Provider value={closeMenu}>
        <MenuItemNode
          node={item({
            label: 'Заполнить',
            command: 'zapolnit',
            enabled: false,
          })}
        />
      </MenuCloseContext.Provider>
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Заполнить' }))
    expect(closeMenu).not.toHaveBeenCalled()
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
      />
    )
    fireEvent.mouseOver(screen.getByText('Заполнить'))
    expect(await screen.findByRole('tooltip')).toBeTruthy()
  })
})

/**
 * Пункты меню тулбара СПИСКА («Создать на основании», печатная форма, зеркала команд
 * строки в «Ещё») работают с ВЫДЕЛЕННОЙ строкой. До 02.09.2026 MenuItemNode поля
 * requiresSelectedRow/selectionField игнорировал и слал COMMAND без value — сервер
 * отвечал «Не выбрана строка списка» даже тогда, когда строка была выбрана.
 */
describe('MenuItemNode: команда по выделенной строке', () => {
  const LIST_ID = 'list.ZayavkaNaRegistratsiyuGPSdelki.list'

  const rowItem = (command: string): ViewNode =>
    item({ label: 'Счёт к оплате', command, enabled: true }, [
      {
        trigger: 'click',
        actionId: 'command',
        command,
        requiresSelectedRow: true,
        selectionField: LIST_ID,
      },
    ] as ViewNode['actions'])

  beforeEach(() => {
    vi.clearAllMocks()
    useSelectionStore.setState({ selection: {} })
  })
  afterEach(cleanup)

  it('строка выделена → COMMAND несёт id строки', () => {
    useSelectionStore.getState().setSelection(LIST_ID, 42)
    render(
      <MenuItemNode node={rowItem('list.createBasedOn:Zayavka:SchetKOplate')} />
    )

    fireEvent.click(screen.getByRole('menuitem', { name: 'Счёт к оплате' }))

    expect(dispatch).toHaveBeenCalledWith(
      {
        type: 'COMMAND',
        command: 'list.createBasedOn:Zayavka:SchetKOplate',
        value: { id: 42 },
        sourceNodeId: 'mi1',
      },
      null
    )
  })

  it('строка не выделена → пункт disabled и команда не уходит', () => {
    render(<MenuItemNode node={rowItem('list.print:Zayavka:Zayavka')} />)

    const mi = screen.getByRole('menuitem', { name: 'Счёт к оплате' })
    expect(mi.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(mi)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('выделение ДРУГОГО списка пункт не активирует (ключ — selectionField)', () => {
    useSelectionStore.getState().setSelection('list.Otpusk.list', 7)
    render(<MenuItemNode node={rowItem('list.print:Zayavka:Zayavka')} />)

    expect(
      screen
        .getByRole('menuitem', { name: 'Счёт к оплате' })
        .getAttribute('aria-disabled')
    ).toBe('true')
  })

  it('пункт без requiresSelectedRow шлёт COMMAND без value — прежнее поведение', () => {
    useSelectionStore.getState().setSelection(LIST_ID, 42)
    render(
      <MenuItemNode
        node={item({ label: 'Заполнить', command: 'zapolnit', enabled: true })}
      />
    )

    fireEvent.click(screen.getByRole('menuitem', { name: 'Заполнить' }))

    expect(dispatch).toHaveBeenCalledWith(
      { type: 'COMMAND', command: 'zapolnit' },
      null
    )
  })
})
