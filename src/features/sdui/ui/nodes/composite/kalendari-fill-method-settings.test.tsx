import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'

const { mockDispatch } = vi.hoisted(() => ({
  mockDispatch: vi.fn().mockResolvedValue(true),
}))
const sessionState: Record<string, unknown> = {}
const treeState: { root: unknown } = { root: null }
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => mockDispatch,
}))
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    setValue: (b: string, v: unknown) => {
      sessionState[b] = v
    },
    getValue: (b?: string) => (b ? sessionState[b] : undefined),
    tree: treeState.root,
  }),
  useBindingValue: (b?: string) => (b ? sessionState[b] : undefined),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
// Дата-поле тянет DateTimeInput со всем деревом зависимостей — для радио-группы
// достаточно заглушки рендера узлов
vi.mock('../../node-renderer', () => ({
  NodeRenderer: ({ node }: { node: ViewNode }) => (
    <div data-testid={`rendered-${node.id}`} />
  ),
}))

import { KalendariFillMethodSettings } from './kalendari-fill-method-settings'

const enumNode = (over?: Record<string, unknown>): ViewNode => ({
  id: 'dict.field.SposobZapolneniya',
  type: 'ENUM_FIELD',
  binding: 'SposobZapolneniya',
  props: {
    label: 'Способ заполнения:',
    control: 'radio',
    visible: true,
    enabled: true,
    options: [
      { value: 'PoNedelyam', label: 'По неделям', id: 31, code: 'PoNedelyam' },
      {
        value: 'PoTsiklamProizvolnoyDliny',
        label: 'По циклам длиной',
        id: 32,
        code: 'PoTsiklamProizvolnoyDliny',
      },
    ],
    ...over,
  },
  actions: [{ trigger: 'change', actionId: 'fieldEvent' }],
})

const dateNode: ViewNode = {
  id: 'dict.field.DataOtscheta',
  type: 'DATE_FIELD',
  binding: 'DataOtscheta',
  props: { label: 'Дата отсчета', visible: true, enabled: true },
}

const settingsNode = (): ViewNode => ({
  id: 'kalendari.fillMethodSettings',
  type: 'HSTACK',
  children: [enumNode(), dateNode],
})

afterEach(() => {
  cleanup()
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  for (const k of Object.keys(sessionState)) delete sessionState[k]
  treeState.root = null
})
beforeEach(() => mockDispatch.mockClear())

describe('KalendariFillMethodSettings (spec v4)', () => {
  it('рендерит радио-опции и дату отсчёта в строке циклической опции', () => {
    sessionState.SposobZapolneniya = { id: 31, code: 'PoNedelyam' }
    render(<KalendariFillMethodSettings node={settingsNode()} />)
    expect(screen.getByLabelText('По неделям')).toBeTruthy()
    expect(screen.getByLabelText('По циклам длиной')).toBeTruthy()
    expect(screen.getByText('sdui.kalendari.daysStartingFrom')).toBeTruthy()
    expect(screen.getByTestId('rendered-dict.field.DataOtscheta')).toBeTruthy()
  })

  it('выбор опции пишет enum-значение в state и шлёт field change EVENT', () => {
    sessionState.SposobZapolneniya = { id: 31, code: 'PoNedelyam' }
    render(<KalendariFillMethodSettings node={settingsNode()} />)
    fireEvent.click(screen.getByLabelText('По циклам длиной'))
    expect(sessionState.SposobZapolneniya).toEqual({
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
      presentation: 'По циклам длиной',
    })
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'EVENT',
      sourceNodeId: 'dict.field.SposobZapolneniya',
      trigger: 'change',
      value: {
        id: 32,
        code: 'PoTsiklamProizvolnoyDliny',
        presentation: 'По циклам длиной',
      },
    })
  })

  it('повторный клик по выбранной опции не шлёт EVENT', () => {
    sessionState.SposobZapolneniya = { id: 31, code: 'PoNedelyam' }
    render(<KalendariFillMethodSettings node={settingsNode()} />)
    fireEvent.click(screen.getByLabelText('По неделям'))
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('invisible поле → ничего не рендерится', () => {
    const n = settingsNode()
    n.children![0].props!.visible = false
    const { container } = render(<KalendariFillMethodSettings node={n} />)
    expect(container.innerHTML).toBe('')
  })
})
