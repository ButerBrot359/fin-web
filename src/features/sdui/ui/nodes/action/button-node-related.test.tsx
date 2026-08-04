import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { handleRelatedCommand } from '../../../lib/open-related-docs'
import { ButtonNode } from './button-node'

const dispatchMock = vi.fn()
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => dispatchMock,
}))
vi.mock('../../../lib/open-related-docs', () => ({
  handleRelatedCommand: vi.fn(),
}))
vi.mock('../../../lib/overflow/overflow-context', () => ({
  useOverflowCollapsed: () => [],
}))
vi.mock('../../../lib/stores/ref-picker-selection-store', () => ({
  useRefPickerSelection: () => null,
}))

const mockHandle = vi.mocked(handleRelatedCommand)

const btn = (command: string, props: Record<string, unknown> = {}): ViewNode =>
  ({
    id: 'btn.x',
    type: 'BUTTON',
    props: { label: 'Кнопка', command, ...props },
  }) as ViewNode

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ButtonNode перехват related.*', () => {
  it('перехваченная команда не диспатчится', () => {
    mockHandle.mockReturnValue(true)
    render(
      <ButtonNode
        node={btn('related.refresh', { anchorId: 'a1', rootId: 'r1' })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Кнопка' }))
    expect(mockHandle).toHaveBeenCalledWith(
      'related.refresh',
      expect.objectContaining({ anchorId: 'a1', rootId: 'r1' })
    )
    expect(dispatchMock).not.toHaveBeenCalled()
  })

  it('чужая команда идёт прежним путём в dispatch', () => {
    mockHandle.mockReturnValue(false)
    render(<ButtonNode node={btn('form.save')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Кнопка' }))
    expect(dispatchMock).toHaveBeenCalledWith(
      { type: 'COMMAND', command: 'form.save' },
      null
    )
  })
})
