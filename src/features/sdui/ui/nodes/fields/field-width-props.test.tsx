import { render, cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { NumberFieldNode } from './number-field-node'
import { TextFieldNode } from './text-field-node'

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

afterEach(cleanup)

const numberNode = (props: Record<string, unknown>): ViewNode => ({
  id: 'dialog.nastroykiVkhoda.field.lengthValue',
  type: 'NUMBER_FIELD',
  binding: 'nastroykiVkhoda.lengthValue',
  props: { visible: true, enabled: true, ...props },
})

describe('NUMBER_FIELD: widthChars / suffix / labelPlacement (SCRUM-355 §5, §8.5)', () => {
  it('widthChars даёт внутреннему input ширину в ch и правое выравнивание', () => {
    const { container } = render(
      <NumberFieldNode node={numberNode({ widthChars: 2 })} />
    )
    const input = container.querySelector('input')
    expect(input?.style.width).toBe('2ch')
    expect(input?.style.textAlign).toBe('right')
  })

  it('suffix рисуется справа от поля', () => {
    render(
      <NumberFieldNode node={numberNode({ widthChars: 2, suffix: 'дней' })} />
    )
    expect(screen.getByText('дней')).toBeTruthy()
  })

  it('labelPlacement=left: подпись снаружи, у input остаётся aria-label', () => {
    const { container } = render(
      <NumberFieldNode
        node={numberNode({
          label: 'Длина генерируемого кода:',
          labelPlacement: 'left',
          widthChars: 3,
        })}
      />
    )
    expect(screen.getByText('Длина генерируемого кода:')).toBeTruthy()
    // MUI-подписи внутри рамки нет — она обрезала бы текст на трёх знаках
    expect(container.querySelector('label.MuiInputLabel-root')).toBeNull()
    expect(screen.getByLabelText('Длина генерируемого кода:')).toBeTruthy()
  })

  it('без пропов поведение прежнее: fullWidth, подпись внутри', () => {
    const { container } = render(
      <NumberFieldNode node={numberNode({ label: 'Сумма' })} />
    )
    expect(container.querySelector('label.MuiInputLabel-root')).toBeTruthy()
    expect(container.querySelector('input')?.style.width).toBe('')
  })
})

describe('TEXT_FIELD: labelPlacement=left (SCRUM-355 §8.6)', () => {
  it('подпись снаружи + aria-label на input', () => {
    const { container } = render(
      <TextFieldNode
        node={{
          id: 'settings.pochta.otpravitel',
          type: 'TEXT_FIELD',
          binding: 'otpravitel',
          props: {
            label: 'Отправитель',
            labelPlacement: 'left',
            visible: true,
            enabled: true,
          },
        }}
      />
    )
    expect(container.querySelector('label.MuiInputLabel-root')).toBeNull()
    expect(screen.getByText('Отправитель')).toBeTruthy()
    expect(screen.getByLabelText('Отправитель')).toBeTruthy()
  })
})
