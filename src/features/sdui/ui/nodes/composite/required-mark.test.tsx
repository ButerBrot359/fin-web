import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RequiredMark } from './required-mark'

describe('RequiredMark', () => {
  it('рендерит label и звёздочку', () => {
    render(<RequiredMark label="Вычет ИПН" />)
    expect(screen.getByText('Вычет ИПН')).toBeTruthy()
    expect(screen.getByText('*')).toBeTruthy()
  })
})
