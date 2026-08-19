import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { DateFieldNode } from './date-field-node'

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => vi.fn(() => Promise.resolve(true)),
}))

const state: Record<string, unknown> = { PeriodRegistratsii: '2026-08-12' }
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

// Настоящий пикер покрыт в datetime-input.test.tsx — здесь предмет теста
// только проводка ключа с ноды в общий компонент даты.
const inputProps: { dateFormat?: string; dateOnly?: boolean } = {}
vi.mock('@/shared/ui/inputs', () => ({
  DateTimeInput: (props: { dateFormat?: string; dateOnly?: boolean }) => {
    inputProps.dateFormat = props.dateFormat
    inputProps.dateOnly = props.dateOnly
    return <input data-testid="date" />
  },
}))

const node = (props: Record<string, unknown>): ViewNode =>
  ({
    id: 'field.periodRegistratsii',
    type: 'DATE_FIELD',
    binding: 'PeriodRegistratsii',
    // visible/enabled явные — по контракту SCRUM-362 B-4 бэк всегда их проставляет
    props: {
      label: 'Месяц начисления',
      dataType: 'DATE',
      visible: true,
      enabled: true,
      ...props,
    },
  }) as ViewNode

describe('DateFieldNode — props.dateFormat', () => {
  afterEach(cleanup)

  it('формат с бэка доезжает до поля даты', () => {
    render(<DateFieldNode node={node({ dateFormat: 'MM.yyyy' })} />)
    expect(inputProps.dateFormat).toBe('MM.yyyy')
    expect(inputProps.dateOnly).toBe(true)
  })

  it('без ключа формат не задаётся — поведение прежнее', () => {
    render(<DateFieldNode node={node({})} />)
    expect(inputProps.dateFormat).toBeUndefined()
  })
})
