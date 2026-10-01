import {
  render,
  cleanup,
  fireEvent,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { NumberFieldNode } from './number-field-node'

const dispatch = vi.fn(() => Promise.resolve(true))
vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => dispatch }))

let state: Record<string, unknown> = {}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    kind: 'panel',
    getSession: () => ({ formSessionId: 'fs-1', revision: 1 }),
    getValue: (b?: string) => (b ? state[b] : undefined),
    setValue: (b: string, v: unknown) => {
      state[b] = v
    },
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))

const TOCHNOSTI = ['0.01', '0.05', '0.1', '0.5', '1', '5', '10', '50', '100']

const node = (props: Record<string, unknown> = {}): ViewNode =>
  ({
    id: 'ir.form.PoryadokOkrugleniya.field.Tochnost',
    type: 'NUMBER_FIELD',
    binding: 'Tochnost',
    actions: [{ trigger: 'change', actionId: 'fieldEvent' }],
    props: {
      label: 'Точность',
      visible: true,
      enabled: true,
      serverEvents: ['change'],
      options: TOCHNOSTI.map((t) => ({ value: t, label: t })),
      ...props,
    },
  }) as ViewNode

beforeEach(() => {
  state = {}
  dispatch.mockClear()
})
afterEach(cleanup)

const input = () => screen.getByRole<HTMLInputElement>('combobox')

const openList = () => {
  fireEvent.mouseDown(input())
  return within(screen.getByRole('listbox')).getAllByRole('option')
}

describe('NUMBER_FIELD с подсказками значений', () => {
  it('показывает все подсказки', () => {
    state.Tochnost = 1
    render(<NumberFieldNode node={node()} />)
    expect(openList().map((i) => i.textContent)).toEqual(TOCHNOSTI)
  })

  it('значение, пришедшее строкой с нулями, показывается числом', () => {
    state.Tochnost = '10.00'
    render(<NumberFieldNode node={node()} />)
    expect(input().value).toBe('10')
  })

  it('выбор подсказки пишет число и шлёт change', () => {
    state.Tochnost = 1
    render(<NumberFieldNode node={node()} />)
    openList()
    fireEvent.click(screen.getByRole('option', { name: '0.05' }))
    expect(state.Tochnost).toBe(0.05)
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('своё значение вводится вручную, запятая допустима', () => {
    state.Tochnost = 1
    render(<NumberFieldNode node={node()} />)
    fireEvent.focus(input())
    fireEvent.change(input(), { target: { value: '0,25' } })
    fireEvent.blur(input())
    expect(state.Tochnost).toBe(0.25)
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('при вводе текста список подсказок не сужается', () => {
    state.Tochnost = 1
    render(<NumberFieldNode node={node()} />)
    fireEvent.change(input(), { target: { value: '7' } })
    expect(openList()).toHaveLength(TOCHNOSTI.length)
  })

  it('нечисловой ввод откатывается к прежнему значению', () => {
    state.Tochnost = 1
    render(<NumberFieldNode node={node()} />)
    fireEvent.focus(input())
    fireEvent.change(input(), { target: { value: 'abc' } })
    fireEvent.blur(input())
    expect(state.Tochnost).toBe(1)
    expect(input().value).toBe('1')
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('blur без правки не шлёт change', () => {
    state.Tochnost = 1
    render(<NumberFieldNode node={node()} />)
    fireEvent.focus(input())
    fireEvent.blur(input())
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('без options — обычный числовой ввод', () => {
    render(<NumberFieldNode node={node({ options: undefined })} />)
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByRole('textbox')).toBeTruthy()
  })
})
