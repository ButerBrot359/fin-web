import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useAssistantDraft } from './use-assistant-draft'

it('keeps independent drafts per document and clears only the current chat', () => {
  const { result, rerender } = renderHook(({ key }) => useAssistantDraft(key), {
    initialProps: { key: 'document:1' },
  })
  act(() => {
    result.current.setDraft('Вопрос по первому документу')
  })
  rerender({ key: 'document:2' })
  expect(result.current.draft).toBe('')
  act(() => {
    result.current.setDraft('Вопрос по второму документу')
  })
  rerender({ key: 'document:1' })
  expect(result.current.draft).toBe('Вопрос по первому документу')
  act(() => {
    result.current.setDraft('')
  })
  rerender({ key: 'document:2' })
  expect(result.current.draft).toBe('Вопрос по второму документу')
})
