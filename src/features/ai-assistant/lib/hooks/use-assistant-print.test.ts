import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAssistantPrint, type PrintTarget } from './use-assistant-print'

const mocks = vi.hoisted(() => ({ getFileBlob: vi.fn(), mutation: vi.fn() }))
vi.mock('@/shared/api/api', () => ({
  apiService: { getFileBlob: mocks.getFileBlob },
}))
vi.mock('@tanstack/react-query', () => ({ useMutation: mocks.mutation }))

describe('useAssistantPrint', () => {
  it('каждая печать проходит через API с проверкой разрешений помощника', async () => {
    const pdf = new Blob(['pdf'], { type: 'application/pdf' })
    mocks.getFileBlob.mockResolvedValue({ data: pdf })
    renderHook(() => useAssistantPrint())
    const options = mocks.mutation.mock.calls[0][0] as {
      mutationFn: (target: PrintTarget) => Promise<Blob>
    }
    expect(
      await options.mutationFn({ typeCode: 'OperatsiyaBukh', entryId: 42 })
    ).toBe(pdf)
    expect(mocks.getFileBlob).toHaveBeenCalledWith({
      url: '/api/ai-assistant/documents/OperatsiyaBukh/42/print',
    })
  })
})
