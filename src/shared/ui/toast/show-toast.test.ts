import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'

import { showToast } from './show-toast'

vi.mock('sonner', () => ({ toast: { custom: vi.fn(), dismiss: vi.fn() } }))

const toastIds = () =>
  vi.mocked(toast.custom).mock.calls.map(([, options]) => options?.id)

describe('showToast', () => {
  beforeEach(() => {
    vi.mocked(toast.custom).mockClear()
  })

  it('одинаковые тосты получают один id и не плодят копии', () => {
    showToast('error', 'Соединение с сервером прервано')
    showToast('error', 'Соединение с сервером прервано')

    const [first, second] = toastIds()
    expect(first).toBeDefined()
    expect(second).toBe(first)
  })

  it('разные тип, заголовок или описание дают разные id', () => {
    showToast('error', 'Ошибка')
    showToast('warning', 'Ошибка')
    showToast('error', 'Другая ошибка')
    showToast('error', 'Ошибка', 'Подробности')

    expect(new Set(toastIds()).size).toBe(4)
  })
})
