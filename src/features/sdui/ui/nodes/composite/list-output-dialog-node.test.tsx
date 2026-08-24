import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { ListOutputDialogNode } from './list-output-dialog-node'

const dispatch = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => dispatch,
}))

const node = {
  id: 'list.output.Tabel',
  type: 'PAGE',
  props: {
    kind: 'LIST_OUTPUT_DIALOG',
    listOutputColumns: [
      { id: 'Data', label: 'Date' },
      { id: 'Nomer', label: 'Number' },
    ],
    listOutputConfirmCommand: 'list.exportList:download',
    listOutputCancelCommand: 'list.exportList:cancel',
  },
} as ViewNode

describe('ListOutputDialogNode', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('sends the server-provided confirm command with exactly the checked column ids', () => {
    render(<ListOutputDialogNode node={node} />)

    fireEvent.click(screen.getByLabelText('Number'))
    fireEvent.click(screen.getByRole('button', { name: 'actions.confirm' }))

    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'list.exportList:download',
      value: ['Data'],
      sourceNodeId: 'list.output.Tabel',
    })
  })

  it('uses the server-provided cancel command without constructing its own command', () => {
    render(<ListOutputDialogNode node={node} />)

    fireEvent.click(screen.getByRole('button', { name: 'actions.cancel' }))

    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'list.exportList:cancel',
      sourceNodeId: 'list.output.Tabel',
    })
  })
})
