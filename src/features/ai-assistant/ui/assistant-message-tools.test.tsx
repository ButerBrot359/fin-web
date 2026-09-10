import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import '@/app/config/i18n'
import { AssistantMessageTools } from './assistant-message-tools'
const toast = vi.hoisted(() => vi.fn())
vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: toast }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  toast.mockClear()
})
describe('message tools', () => {
  it('handles clipboard denial and copies without editing or sending', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Denied'))
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const edit = vi.fn()
    render(
      <AssistantMessageTools
        text="Ответ"
        failedQuestion="Вопрос"
        onEditQuestion={edit}
      />
    )
    fireEvent.click(screen.getAllByRole('button')[0])
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith('error', expect.any(String))
    })
    expect(edit).not.toHaveBeenCalled()
    writeText.mockResolvedValue(undefined)
    fireEvent.click(screen.getAllByRole('button')[0])
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith('success', expect.any(String))
    })
    expect(writeText).toHaveBeenCalledWith('Ответ')
    fireEvent.click(screen.getAllByRole('button')[1])
    expect(edit).toHaveBeenCalledWith('Вопрос')
  })
})
