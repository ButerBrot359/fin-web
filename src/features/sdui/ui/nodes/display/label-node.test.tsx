import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { LabelNode } from './label-node'

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => vi.fn(),
}))

const label = (props: Record<string, unknown>): ViewNode =>
  ({ id: 'l1', type: 'LABEL', props }) as ViewNode

describe('LabelNode: серверные варианты страницы модуля (SCRUM-181)', () => {
  afterEach(cleanup)

  it('keeps module page and section headings visually distinct', () => {
    const { rerender } = render(
      <LabelNode
        node={label({ text: 'Банк и касса', variant: 'module-title' })}
      />
    )
    expect(screen.getByText('Банк и касса').className).toContain(
      'MuiTypography-h5'
    )

    rerender(
      <LabelNode
        node={label({ text: 'Операции', variant: 'module-section' })}
      />
    )
    expect(screen.getByText('Операции').className).toContain(
      'MuiTypography-subtitle1'
    )
  })
})
