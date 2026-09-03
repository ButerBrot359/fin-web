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

// SCRUM-278 (после теста): серверное предупреждение о недозаполненном графике
// рендерится красным со значком, как в 1С.
describe('LabelNode: variant=warning', () => {
  afterEach(cleanup)

  it('warning: красный текст и значок предупреждения', () => {
    render(
      <LabelNode
        node={label({
          text: 'График работы заполнен до 31.12.2026, с учетом горизонта планирования график должен быть заполнен до 28.08.2027',
          variant: 'warning',
        })}
      />
    )
    const el = screen.getByText(/заполнен до 31\.12\.2026/)
    expect(el.querySelector('svg')).not.toBeNull()
  })
})
