import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { useSelectionStore } from '../../../lib/stores/selection-store'
import { ButtonNode } from './button-node'

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => vi.fn(),
}))

vi.mock('../../../lib/use-sdui-effects', () => ({
  useSduiEffects: () => ({
    executeActionRequest: vi.fn(),
    play: vi.fn(),
    playAll: vi.fn(),
  }),
}))

vi.mock('../../node-renderer', () => ({
  NodeRenderer: () => null,
}))

// requiresSelectedRow/selectionField приходят на click-action (SCRUM-284 Δ4),
// command берётся из props (props.command побеждает, SCRUM-283).
const button = (label: string, action: Record<string, unknown>): ViewNode =>
  ({
    id: 'b1',
    type: 'BUTTON',
    // SCRUM-362 B-4: enabled эмитится бэком явно — без него кнопка disabled.
    props: { label, command: 'noparse', enabled: true },
    actions: [{ trigger: 'click', actionId: 'command', ...action }],
  }) as ViewNode

const isDisabled = (name: string) =>
  screen.getByRole('button', { name }).hasAttribute('disabled')

describe('ButtonNode: requiresSelectedRow с action (SCRUM-284 Δ4)', () => {
  beforeEach(() => {
    useSelectionStore.setState({ selection: {} })
  })
  afterEach(cleanup)

  it('action.requiresSelectedRow:true → disabled без выбранной строки', () => {
    render(
      <ButtonNode
        node={button('Выбрать', {
          requiresSelectedRow: true,
          selectionField: 'field.x',
        })}
      />
    )
    expect(isDisabled('Выбрать')).toBe(true)
  })

  it('активна после выбора строки по selectionField с action', () => {
    render(
      <ButtonNode
        node={button('Выбрать', {
          requiresSelectedRow: true,
          selectionField: 'field.x',
        })}
      />
    )
    expect(isDisabled('Выбрать')).toBe(true)
    act(() => {
      useSelectionStore.getState().setSelection('field.x', 42)
    })
    expect(isDisabled('Выбрать')).toBe(false)
  })

  it('requiresSelectedRow:null («Создать») → активна всегда', () => {
    render(
      <ButtonNode
        node={button('Создать', {
          requiresSelectedRow: null,
          selectionField: null,
        })}
      />
    )
    expect(isDisabled('Создать')).toBe(false)
  })
})
