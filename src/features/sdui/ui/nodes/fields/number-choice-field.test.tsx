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

describe('NUMBER_FIELD со списком выбора', () => {
  it('рисует выпадающий список со всеми значениями', () => {
    state.Tochnost = 1
    render(<NumberFieldNode node={node()} />)
    fireEvent.mouseDown(screen.getByRole('combobox'))
    const items = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(items.map((i) => i.textContent)).toEqual(TOCHNOSTI)
  })

  it('показывает текущее значение, пришедшее числом с хвостом нулей', () => {
    state.Tochnost = '1.00'
    render(<NumberFieldNode node={node()} />)
    expect(screen.getByRole('combobox').textContent).toBe('1')
  })

  it('выбор пишет число в сессию', () => {
    state.Tochnost = 1
    render(<NumberFieldNode node={node()} />)
    fireEvent.mouseDown(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: '0.05' }))
    expect(state.Tochnost).toBe(0.05)
  })

  it('значение вне списка не теряется', () => {
    state.Tochnost = 0.001
    render(<NumberFieldNode node={node()} />)
    expect(screen.getByRole('combobox').textContent).toBe('0.001')
  })

  it('без options — обычный числовой ввод', () => {
    render(<NumberFieldNode node={node({ options: undefined })} />)
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByRole('textbox')).toBeTruthy()
  })
})
