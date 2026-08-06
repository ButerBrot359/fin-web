import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import type { ViewNode } from '../../types/view'
import { useTableValidation } from './use-table-validation'
import { revealAllTableErrors } from '../table-validation-registry'

const node: ViewNode = { id: 't', type: 'TABLE', binding: 'VychetyIPN' }

function Probe() {
  const { revealErrors } = useTableValidation(node)
  return <span>{revealErrors ? 'on' : 'off'}</span>
}

describe('useTableValidation', () => {
  it('revealErrors=false до сабмита, true после revealAll', () => {
    render(<Probe />)
    expect(screen.getByText('off')).toBeTruthy()
    act(() => {
      revealAllTableErrors()
    })
    expect(screen.getByText('on')).toBeTruthy()
  })
})
