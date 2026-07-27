import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { useRefPickerSelectionStore } from '../../../lib/stores/ref-picker-selection-store'
import { ButtonNode } from './button-node'

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => vi.fn(),
}))

const button = (props: Record<string, unknown>): ViewNode =>
  ({ id: 'b1', type: 'BUTTON', props }) as ViewNode

const isDisabled = (name: string) =>
  screen.getByRole('button', { name }).hasAttribute('disabled')

describe('ButtonNode: requiresSelectedRow из props (SCRUM-285 A3)', () => {
  beforeEach(() => {
    useRefPickerSelectionStore.setState({ selection: {} })
  })
  afterEach(cleanup)

  it('requiresSelectedRow:true → disabled без выбранной строки (не по имени команды)', () => {
    render(
      <ButtonNode
        node={button({
          label: 'Выбрать',
          command: 'noparse',
          requiresSelectedRow: true,
          selectionKey: 'field.x',
        })}
      />,
    )
    expect(isDisabled('Выбрать')).toBe(true)
  })

  it('становится активной после выбора строки по selectionKey', () => {
    render(
      <ButtonNode
        node={button({
          label: 'Выбрать',
          command: 'noparse',
          requiresSelectedRow: true,
          selectionKey: 'field.x',
        })}
      />,
    )
    expect(isDisabled('Выбрать')).toBe(true)
    act(() => {
      useRefPickerSelectionStore.getState().setSelection('field.x', 42)
    })
    expect(isDisabled('Выбрать')).toBe(false)
  })

  it('без requiresSelectedRow активна всегда («Создать»)', () => {
    render(
      <ButtonNode
        node={button({ label: 'Создать', command: 'ref.create:field.x' })}
      />,
    )
    expect(isDisabled('Создать')).toBe(false)
  })
})
