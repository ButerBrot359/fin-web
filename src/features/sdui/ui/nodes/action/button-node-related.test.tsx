import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { ButtonNode } from './button-node'

const dispatchMock = vi.fn()
const executeActionRequestMock = vi.fn()
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => dispatchMock,
}))
vi.mock('../../../lib/use-sdui-effects', () => ({
  useSduiEffects: () => ({
    executeActionRequest: executeActionRequestMock,
    play: vi.fn(),
    playAll: vi.fn(),
  }),
}))
vi.mock('../../../lib/overflow/overflow-context', () => ({
  useOverflowCollapsed: () => [],
}))
vi.mock('../../../lib/stores/selection-store', () => ({
  useSelection: () => 'row-7',
}))

const btnWithRequest = (): ViewNode =>
  ({
    id: 'btn.post',
    type: 'BUTTON',
    props: { label: 'Провести' },
    actions: [
      {
        trigger: 'click',
        actionId: 'post',
        requiresSelectedRow: true,
        selectionField: 'related.a1',
        request: {
          method: 'POST',
          url: '/api/view/related-documents/post?rootId=1&anchorId=a1',
        },
      },
    ],
  }) as ViewNode

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ButtonNode — путь request (SCRUM-288 §2.1)', () => {
  it('клик исполняет request с selectedRowId, НЕ диспатчит COMMAND', () => {
    render(<ButtonNode node={btnWithRequest()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Провести' }))
    expect(executeActionRequestMock).toHaveBeenCalledWith(
      {
        method: 'POST',
        url: '/api/view/related-documents/post?rootId=1&anchorId=a1',
      },
      'row-7'
    )
    expect(dispatchMock).not.toHaveBeenCalled()
  })

  it('кнопка без request идёт прежним путём в dispatch', () => {
    const node = {
      id: 'b',
      type: 'BUTTON',
      props: { label: 'Сохранить', command: 'form.save' },
    } as ViewNode
    render(<ButtonNode node={node} />)
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(dispatchMock).toHaveBeenCalledWith(
      { type: 'COMMAND', command: 'form.save' },
      null
    )
    expect(executeActionRequestMock).not.toHaveBeenCalled()
  })
})
