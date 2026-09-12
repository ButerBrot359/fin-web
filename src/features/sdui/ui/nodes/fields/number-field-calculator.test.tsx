import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { NumberFieldNode } from './number-field-node'

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => vi.fn(() => Promise.resolve(true)),
}))

const state: Record<string, unknown> = {}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    kind: 'panel',
    getSession: () => ({ formSessionId: null, revision: null }),
    getValue: (b?: string) => (b ? state[b] : undefined),
    setValue: (b: string, v: unknown) => {
      state[b] = v
    },
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))

const captured: { calculator?: boolean } = {}
vi.mock('@/shared/ui/inputs', () => ({
  NumberInput: (props: { calculator?: boolean }) => {
    captured.calculator = props.calculator
    return <input data-testid="number" />
  },
}))

const node = (props: Record<string, unknown>): ViewNode =>
  ({
    id: 'field.summaDokumenta',
    type: 'NUMBER_FIELD',
    binding: 'SummaDokumenta',
    props: { label: 'Сумма документа', visible: true, enabled: true, ...props },
  }) as ViewNode

/**
 * Калькулятор — заявление бэка, а не решение фронта: пилот включён только у
 * «Суммы документа» ПКО (`props.calculator: true`), остальные числовые поля
 * должны остаться как были.
 */
describe('NUMBER_FIELD — кнопка калькулятора по props.calculator', () => {
  afterEach(cleanup)

  it('проп с провода включает калькулятор', () => {
    render(<NumberFieldNode node={node({ calculator: true })} />)
    expect(captured.calculator).toBe(true)
  })

  it('без пропа калькулятора нет', () => {
    render(<NumberFieldNode node={node({})} />)
    expect(captured.calculator).toBe(false)
  })
})
