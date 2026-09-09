import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { TextFieldNode } from './text-field-node'
import { NumberFieldNode } from './number-field-node'
import { DateFieldNode } from './date-field-node'

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

// Сами инпуты покрыты своими тестами — здесь предмет теста только проводка
// props.size с провода в компонент (контракт конструктора дизайна §1:
// size:'small' → компактный инлайн-инпут 36px, высоту пинует тема).
const captured: { number?: string; date?: string } = {}
vi.mock('@/shared/ui/inputs', () => ({
  NumberInput: (props: { size?: string }) => {
    captured.number = props.size
    return <input data-testid="number" />
  },
  DateTimeInput: (props: { size?: string }) => {
    captured.date = props.size
    return <input data-testid="date" />
  },
}))

const node = (type: string, props: Record<string, unknown>): ViewNode =>
  ({
    id: `field.${type}`,
    type,
    binding: 'Field',
    props: { label: 'Поле', visible: true, enabled: true, ...props },
  }) as ViewNode

describe('props.size="small" — проводка с провода в инпуты', () => {
  afterEach(cleanup)

  it('TEXT_FIELD: small вешает MuiInputBase-sizeSmall (тема пинует 36px)', () => {
    const { container } = render(
      <TextFieldNode node={node('TEXT_FIELD', { size: 'small' })} />
    )
    const base = container.querySelector('.MuiInputBase-root')
    expect(base?.classList.contains('MuiInputBase-sizeSmall')).toBe(true)
  })

  it('TEXT_FIELD: без пропа — полноразмерное поле', () => {
    const { container } = render(
      <TextFieldNode node={node('TEXT_FIELD', {})} />
    )
    const base = container.querySelector('.MuiInputBase-root')
    expect(base?.classList.contains('MuiInputBase-sizeSmall')).toBe(false)
  })

  it('NUMBER_FIELD: size доезжает до NumberInput', () => {
    render(<NumberFieldNode node={node('NUMBER_FIELD', { size: 'small' })} />)
    expect(captured.number).toBe('small')
  })

  it('DATE_FIELD: size доезжает до DateTimeInput', () => {
    render(<DateFieldNode node={node('DATE_FIELD', { size: 'small' })} />)
    expect(captured.date).toBe('small')
  })

  it('NUMBER/DATE: без пропа size не задаётся', () => {
    render(<NumberFieldNode node={node('NUMBER_FIELD', {})} />)
    render(<DateFieldNode node={node('DATE_FIELD', {})} />)
    expect(captured.number).toBeUndefined()
    expect(captured.date).toBeUndefined()
  })
})
