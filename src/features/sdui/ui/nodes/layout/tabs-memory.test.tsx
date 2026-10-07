import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import {
  SduiSessionProvider,
  type SduiSessionValue,
} from '../../../lib/sdui-session-context'
import {
  forgetTabsMemory,
  useTabsMemoryStore,
} from '../../../lib/stores/tabs-memory-store'
import { TabsNode } from './tabs-node'

vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => vi.fn() }))
vi.mock('../../node-renderer', () => ({
  NodeRenderer: ({ node }: { node: ViewNode }) => <span>{node.id}</span>,
}))

afterEach(() => {
  cleanup()
  useTabsMemoryStore.setState({ entries: {} })
})

const DOC_ROUTE = '/documents/nachislenie-zarplaty/42'
const OTHER_ROUTE = '/documents/nachislenie-zarplaty/43'

const tab = (id: string, title: string, visible = true): ViewNode =>
  ({
    id,
    type: 'TAB',
    props: { title, visible },
    children: [{ id: `${id}.content`, type: 'TEXT_FIELD' }],
  }) as ViewNode

const node = (itogiVisible = true): ViewNode =>
  ({
    id: 'tabs.main',
    type: 'TABS',
    props: {},
    children: [
      tab('tab.nachisleniya', 'Начисления'),
      tab('tab.uderzhaniya', 'Удержания'),
      tab('tab.itogi', 'Итоги', itogiVisible),
    ],
  }) as ViewNode

const renderOn = (route: string | undefined, tree: ViewNode = node()) =>
  render(
    <SduiSessionProvider
      value={{ kind: 'root', screenRoute: route } as SduiSessionValue}
    >
      <TabsNode node={tree} />
    </SduiSessionProvider>
  )

const selected = () =>
  screen
    .getAllByRole('tab')
    .find((el) => el.getAttribute('aria-selected') === 'true')?.textContent

describe('TabsNode: активная вкладка переживает уход из окна', () => {
  it('после ремаунта формы открыта та вкладка, с которой ушли', () => {
    renderOn(DOC_ROUTE)
    fireEvent.click(screen.getByRole('tab', { name: 'Итоги' }))
    cleanup()

    renderOn(DOC_ROUTE)
    expect(selected()).toBe('Итоги')
    expect(screen.getByText('tab.itogi.content')).toBeTruthy()
  })

  it('другой документ своей памяти не наследует', () => {
    renderOn(DOC_ROUTE)
    fireEvent.click(screen.getByRole('tab', { name: 'Итоги' }))
    cleanup()

    renderOn(OTHER_ROUTE)
    expect(selected()).toBe('Начисления')
  })

  it('закрытие окна забывает вкладку', () => {
    renderOn(DOC_ROUTE)
    fireEvent.click(screen.getByRole('tab', { name: 'Итоги' }))
    cleanup()
    forgetTabsMemory(DOC_ROUTE)

    renderOn(DOC_ROUTE)
    expect(selected()).toBe('Начисления')
  })

  it('запомненная вкладка скрыта при возврате — открывается первая', () => {
    renderOn(DOC_ROUTE)
    fireEvent.click(screen.getByRole('tab', { name: 'Итоги' }))
    cleanup()

    renderOn(DOC_ROUTE, node(false))
    expect(selected()).toBe('Начисления')
  })

  it('без маршрута экрана (панель) память не ведётся', () => {
    renderOn(undefined)
    fireEvent.click(screen.getByRole('tab', { name: 'Итоги' }))
    expect(useTabsMemoryStore.getState().entries).toEqual({})
  })
})
