import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
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

const node = (secret?: boolean): ViewNode => ({
  id: 'settings.pochta.parol',
  type: 'TEXT_FIELD',
  binding: 'parol',
  props: { label: 'Пароль', visible: true, enabled: true, secret },
})

describe('TEXT_FIELD props.secret (SCRUM-308 v1 §4.2 / SCRUM-355 §5.5)', () => {
  it('secret: true → скрытый ввод и autoComplete=new-password', () => {
    const { container } = render(<TextFieldNode node={node(true)} />)
    const input = container.querySelector('input')
    expect(input?.getAttribute('type')).toBe('password')
    // Менеджер паролей не должен подставить сюда пароль пользователя от webbuh
    expect(input?.getAttribute('autocomplete')).toBe('new-password')
  })

  it('без пропа поле остаётся обычным текстом', () => {
    const { container } = render(<TextFieldNode node={node()} />)
    const input = container.querySelector('input')
    expect(input?.getAttribute('type')).not.toBe('password')
  })
})
