import {
  render,
  cleanup,
  fireEvent,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
  { value: 'a', label: 'Опция A' },
  { value: 'b', label: 'Опция B' },
]
const node = (readonly: boolean): ViewNode => ({
  id: 'field.vidOperatsii',
  type: 'ENUM_FIELD',
  binding: 'VidOperatsii',
  props: { label: 'Вид операции', options, readonly },
})

afterEach(cleanup)

describe('EnumFieldNode readonly', () => {
  it('readonly → без иконки раскрытия', () => {
    const { container } = render(<EnumFieldNode node={node(true)} />)
    expect(container.querySelector('.MuiSelect-icon')).toBeNull()
  })
  it('editable → иконка раскрытия есть', () => {
    const { container } = render(<EnumFieldNode node={node(false)} />)
    expect(container.querySelector('.MuiSelect-icon')).toBeTruthy()
  })
})

const richOptions = [
  { value: 'week', label: 'По неделям', id: 31, code: 'PoNedelyam' },
  {
    value: 'cycle',
    label: 'По циклам',
    id: 32,
    code: 'PoTsiklamProizvolnoyDliny',
  },
]
const richNode = (): ViewNode => ({
  id: 'field.sposob',
  type: 'ENUM_FIELD',
  binding: 'SposobZapolneniya',
  props: { label: 'Способ', options: richOptions },
  actions: [{ trigger: 'change', actionId: 'fieldEvent' }],
})

describe('EnumFieldNode форма значения', () => {
  it('гидрация из полного объекта → выбран нужный пункт', () => {
    state.SposobZapolneniya = {
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
      presentation: 'По циклам',
    }
    render(<EnumFieldNode node={richNode()} />)
    expect(screen.getByText('По циклам')).toBeTruthy()
    delete state.SposobZapolneniya
  })

  it('гидрация из строки-кода → выбран нужный пункт', () => {
    state.SposobZapolneniya = 'week'
    render(<EnumFieldNode node={richNode()} />)
    expect(screen.getByText('По неделям')).toBeTruthy()
    delete state.SposobZapolneniya
  })

  it('после выбора в session-state лежит полный объект {id, code, presentation}', () => {
    delete state.SposobZapolneniya
    render(<EnumFieldNode node={richNode()} />)
    fireEvent.mouseDown(screen.getByRole('combobox'))
    const listbox = within(screen.getByRole('listbox'))
    fireEvent.click(listbox.getByText('По циклам'))
    expect(state.SposobZapolneniya).toEqual({
      id: 32,
      code: 'PoTsiklamProizvolnoyDliny',
      presentation: 'По циклам',
    })
    delete state.SposobZapolneniya
  })
})
