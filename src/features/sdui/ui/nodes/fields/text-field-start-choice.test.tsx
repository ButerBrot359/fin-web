import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { TextFieldNode } from './text-field-node'

const dispatch = vi.fn()
let inFlight = false
vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => dispatch }))
vi.mock('../../../lib/stores/command-inflight-store', () => ({
  useCommandInFlight: () => inFlight,
}))
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({ setValue: vi.fn() }),
  useBindingValue: () => undefined,
}))

afterEach(() => {
  cleanup()
  dispatch.mockReset()
  inFlight = false
})

const choiceName = /(inputs\.startChoice|Выбрать): Файл 5-15А/

const behavior = {
  flushPendingTables: true,
  resetsDirty: false,
  closeAfter: false,
}

const node = (withChoice: boolean): ViewNode => ({
  id: 'field.imyaFaylaZagruzki',
  type: 'TEXT_FIELD',
  binding: 'ImyaFaylaZagruzki',
  props: { label: 'Файл 5-15А', visible: true, enabled: true, readonly: true },
  actions: [
    { trigger: 'change', actionId: 'fieldEvent' },
    ...(withChoice
      ? [
          {
            trigger: 'startChoice',
            actionId: 'command',
            command: 'kontrolnayaVedomost515aZagruzitDannye',
            behavior,
          },
        ]
      : []),
  ],
})

describe('TEXT_FIELD: кнопка выбора по действию startChoice', () => {
  it('кнопка шлёт серверную команду с поведением из действия', () => {
    render(<TextFieldNode node={node(true)} />)
    fireEvent.click(screen.getByRole('button', { name: choiceName }))
    expect(dispatch).toHaveBeenCalledWith(
      {
        type: 'COMMAND',
        command: 'kontrolnayaVedomost515aZagruzitDannye',
        sourceNodeId: 'field.imyaFaylaZagruzki',
      },
      behavior
    )
  })

  it('пока команда формы в полёте, кнопка недоступна', () => {
    inFlight = true
    render(<TextFieldNode node={node(true)} />)
    expect(screen.getByRole('button', { name: choiceName })).toBeDisabled()
  })

  it('без действия startChoice кнопки нет', () => {
    render(<TextFieldNode node={node(false)} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
