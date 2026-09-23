import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { EnumFieldNode } from './enum-field-node'

const state: Record<string, unknown> = {}
vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => vi.fn() }))
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    setValue: (b: string, v: unknown) => {
      state[b] = v
    },
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))

const options = [
  { value: 'a', label: 'Выбранным пользователям' },
  { value: 'b', label: 'Всем пользователям' },
]

const node = (control: string, extraOptions: object[] = options): ViewNode => ({
  id: 'settings.kopirovanieNastroek.komu',
  type: 'ENUM_FIELD',
  binding: 'komu',
  props: {
    label: 'Кому копировать:',
    control,
    options: extraOptions,
    visible: true,
    enabled: true,
  },
})

beforeEach(() => {
  delete state.komu
})
afterEach(cleanup)

describe('ENUM_FIELD control=radio (SCRUM-308 v3 §4)', () => {
  it('рисует радиогруппу вместо селекта', () => {
    const { container } = render(<EnumFieldNode node={node('radio')} />)
    expect(container.querySelector('.MuiRadioGroup-root')).toBeTruthy()
    expect(container.querySelector('.MuiSelect-select')).toBeNull()
    expect(screen.getByText('Кому копировать:')).toBeTruthy()
    expect(screen.getByLabelText('Всем пользователям')).toBeTruthy()
  })

  it('выбор опции пишет enum-значение в state', () => {
    render(<EnumFieldNode node={node('radio')} />)
    fireEvent.click(screen.getByLabelText('Всем пользователям'))
    expect(state.komu).toMatchObject({ code: 'b', id: 'b' })
  })

  it('погашенная опция (§3.5) не выбирается', () => {
    render(
      <EnumFieldNode
        node={node('radio', [
          options[0],
          {
            value: 'b',
            label: 'Всем пользователям',
            disabled: true,
            disabledReason: 'Недостаточно прав',
          },
        ])}
      />
    )
    const radio = screen.getByLabelText('Всем пользователям')
    expect((radio as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(radio)
    expect(state.komu).toBeUndefined()
  })
})

describe('ENUM_FIELD control=segmented', () => {
  it('рисует сегментированный переключатель', () => {
    const { container } = render(<EnumFieldNode node={node('segmented')} />)
    expect(container.querySelector('.MuiToggleButtonGroup-root')).toBeTruthy()
    expect(container.querySelector('.MuiSelect-select')).toBeNull()
  })

  it('клик по сегменту пишет enum-значение', () => {
    render(<EnumFieldNode node={node('segmented')} />)
    fireEvent.click(screen.getByText('Всем пользователям'))
    expect(state.komu).toMatchObject({ code: 'b' })
  })
})

describe('ENUM_FIELD без control', () => {
  it('остаётся обычным селектом', () => {
    const { container } = render(
      <EnumFieldNode
        node={{
          ...node('radio'),
          props: { ...node('radio').props, control: undefined },
        }}
      />
    )
    expect(container.querySelector('.MuiSelect-select')).toBeTruthy()
  })
})
