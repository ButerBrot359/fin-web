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
  // visible/enabled явные — по контракту SCRUM-362 B-4 бэк всегда их проставляет
  props: {
    label: 'Вид операции',
    options,
    readonly,
    visible: true,
    enabled: true,
  },
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

describe('EnumFieldNode ширина', () => {
  // Содержимое TAB рендерится в обычный блочный div, без flex-контейнера:
  // FormControl там inline-flex и схлопывается до содержимого (~40px у пустого
  // перечисления, подпись обрезается «Ст…»). В VSTACK этого не видно —
  // там alignItems: 'stretch' растягивает детей за нас.
  it('поле растягивается в блочном контейнере', () => {
    const { container } = render(
      <div style={{ display: 'block' }}>
        <EnumFieldNode node={node(false)} />
      </div>
    )
    const control = container.querySelector('.MuiFormControl-root')
    expect(control).toBeTruthy()
    expect(control?.classList.contains('MuiFormControl-fullWidth')).toBe(true)
    expect(getComputedStyle(control as HTMLElement).width).toBe('100%')
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
  props: {
    label: 'Способ',
    options: richOptions,
    visible: true,
    enabled: true,
  },
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
