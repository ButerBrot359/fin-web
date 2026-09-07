import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { TextFieldNode } from './text-field-node'

vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => vi.fn() }))
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({ setValue: vi.fn() }),
  useBindingValue: () => undefined,
}))

afterEach(cleanup)

const node = (maxLength?: number): ViewNode =>
  ({
    id: 'field.kommentariy',
    type: 'TEXT_FIELD',
    binding: 'Kommentariy',
    props: { label: 'Комментарий', visible: true, enabled: true, maxLength },
  }) as ViewNode

describe('TextFieldNode maxLength', () => {
  // Длина 0 в 1С — «строка неограниченной длины»; атрибут maxlength="0" запрещал ввод вовсе
  it('нулевая длина не превращается в maxlength="0"', () => {
    const { container } = render(<TextFieldNode node={node(0)} />)
    expect(container.querySelector('input')?.getAttribute('maxlength')).toBeNull()
  })

  it('положительная длина едет в input', () => {
    const { container } = render(<TextFieldNode node={node(250)} />)
    expect(container.querySelector('input')?.getAttribute('maxlength')).toBe('250')
  })
})
