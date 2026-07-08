import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from './confirm-dialog'

vi.mock('@/shared/assets/icons/cross.svg', () => ({ default: () => null }))

const renderDialog = (onConfirm = vi.fn(), onCancel = vi.fn()) => {
  render(
    <ConfirmDialog
      open
      title="Заголовок"
      message="Текст сообщения"
      confirmLabel="Да"
      cancelLabel="Нет"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )
  return { onConfirm, onCancel }
}

describe('ConfirmDialog', () => {
  afterEach(cleanup)

  it('рендерит заголовок, сообщение и обе кнопки', () => {
    renderDialog()
    expect(screen.getByText('Заголовок')).toBeTruthy()
    expect(screen.getByText('Текст сообщения')).toBeTruthy()
    expect(screen.getByText('Да')).toBeTruthy()
    expect(screen.getByText('Нет')).toBeTruthy()
  })

  it('клик по confirm вызывает onConfirm', () => {
    const { onConfirm, onCancel } = renderDialog()
    fireEvent.click(screen.getByText('Да'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('клик по cancel вызывает onCancel', () => {
    const { onConfirm, onCancel } = renderDialog()
    fireEvent.click(screen.getByText('Нет'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
