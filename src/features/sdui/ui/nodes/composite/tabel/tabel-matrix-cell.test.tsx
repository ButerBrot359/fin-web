import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TabelMatrixCell } from './tabel-matrix-cell'

describe('TabelMatrixCell: коммит и отмена ввода (SCRUM-276 §4/§5)', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('blur с изменённым значением коммитит ввод', () => {
    const onCommit = vi.fn().mockReturnValue(true)
    render(
      <TabelMatrixCell
        value="8"
        readOnly={false}
        weekend={false}
        onCommit={onCommit}
      />
    )
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '12' } })
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledWith('12')
  })

  it('blur без изменения значения НЕ коммитит', () => {
    const onCommit = vi.fn()
    render(
      <TabelMatrixCell
        value="8"
        readOnly={false}
        weekend={false}
        onCommit={onCommit}
      />
    )
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.blur(input)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('Escape отменяет ввод: onCommit НЕ вызывается, значение откатывается', () => {
    const onCommit = vi.fn()
    render(
      <TabelMatrixCell
        value="8"
        readOnly={false}
        weekend={false}
        onCommit={onCommit}
      />
    )
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '12' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    // jsdom не вызывает blur из .blur() внутри keyDown автоматически надёжно —
    // эмулируем последовательность браузера: keyDown → blur
    fireEvent.blur(input)
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe('8')
  })

  it('после Escape следующий blur снова коммитит (флаг отмены одноразовый)', () => {
    const onCommit = vi.fn().mockReturnValue(true)
    render(
      <TabelMatrixCell
        value="8"
        readOnly={false}
        weekend={false}
        onCommit={onCommit}
      />
    )
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '12' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.blur(input)
    expect(onCommit).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledWith('10')
  })

  it('отказ сервера (промис false) откатывает буфер на канон', async () => {
    const onCommit = vi.fn().mockResolvedValue(false)
    render(
      <TabelMatrixCell
        value="8"
        readOnly={false}
        weekend={false}
        onCommit={onCommit}
      />
    )
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '12' } })
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledWith('12')
    await waitFor(() => {
      expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe('8')
    })
  })

  it('успех сервера (промис true) не трогает буфер', async () => {
    const onCommit = vi.fn().mockResolvedValue(true)
    render(
      <TabelMatrixCell
        value="8"
        readOnly={false}
        weekend={false}
        onCommit={onCommit}
      />
    )
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '12' } })
    fireEvent.blur(input)
    await waitFor(() => {
      expect(onCommit).toHaveBeenCalled()
    })
    expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe('12')
  })
})
