import { render, cleanup } from '@testing-library/react'
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
