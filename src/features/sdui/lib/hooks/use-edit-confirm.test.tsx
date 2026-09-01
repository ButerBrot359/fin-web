import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useConfirmStore } from '../stores/confirm-store'
import { useEditConfirm } from './use-edit-confirm'

function Probe({ message }: { message?: string }) {
  const editConfirm = useEditConfirm(message)
  return <input aria-label="field" onFocus={editConfirm.onFocus} />
}

describe('useEditConfirm', () => {
  beforeEach(() => {
    cleanup()
    useConfirmStore.setState({ open: false, message: '', resolve: null })
  })

  it('без props.editConfirm вопрос не задаётся', () => {
    render(<Probe />)
    fireEvent.focus(screen.getByLabelText('field'))
    expect(useConfirmStore.getState().open).toBe(false)
  })

  it('первый фокус задаёт вопрос', () => {
    render(<Probe message="Продолжить редактирование?" />)
    fireEvent.focus(screen.getByLabelText('field'))
    expect(useConfirmStore.getState().open).toBe(true)
    expect(useConfirmStore.getState().message).toBe(
      'Продолжить редактирование?'
    )
  })

  it('ответ «нет» снимает фокус с поля', async () => {
    render(<Probe message="Продолжить редактирование?" />)
    const input = screen.getByLabelText('field')
    const blur = vi.spyOn(input, 'blur')
    fireEvent.focus(input)
    useConfirmStore.getState().answer(false)
    await waitFor(() => {
      expect(blur).toHaveBeenCalled()
    })
  })

  it('ответ «да» фокус не трогает и повторно не спрашивает', async () => {
    render(<Probe message="Продолжить редактирование?" />)
    const input = screen.getByLabelText('field')
    const blur = vi.spyOn(input, 'blur')
    fireEvent.focus(input)
    useConfirmStore.getState().answer(true)
    await waitFor(() => {
      expect(useConfirmStore.getState().open).toBe(false)
    })
    expect(blur).not.toHaveBeenCalled()

    fireEvent.focus(input)
    expect(useConfirmStore.getState().open).toBe(false)
  })
})
