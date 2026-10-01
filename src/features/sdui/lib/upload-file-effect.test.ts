import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiService } from '@/shared/api/api'

import type { ViewEffect } from '../types/view'
import { pickFile } from './pick-file'
import { uploadFileByEffect } from './upload-file-effect'

vi.mock('@/shared/api/api', () => ({
  apiService: { postFormData: vi.fn() },
}))
vi.mock('./pick-file', () => ({ pickFile: vi.fn() }))

const toasts: { type: string; title: string }[] = []
vi.mock('@/shared/ui/toast/show-toast', () => ({
  showToast: (type: string, title: string) => {
    toasts.push({ type, title })
  },
}))
vi.mock('@/app/config/i18n', () => ({
  default: { t: (key: string) => key },
}))

const effect: ViewEffect = {
  type: 'uploadFile',
  url: '/api/vypiska-5-15/42/zagruzit-dannye',
  accept: 'application/pdf,.pdf',
  maxSizeBytes: 100,
  successCommand: 'reread',
}

function file(size: number): File {
  return new File([new Uint8Array(size)], 'vypiska.pdf', {
    type: 'application/pdf',
  })
}

describe('эффект uploadFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    toasts.length = 0
  })

  it('успех: файл уходит multipart-полем file, затем шлётся successCommand', async () => {
    vi.mocked(pickFile).mockResolvedValue(file(10))
    vi.mocked(apiService.postFormData).mockResolvedValue({
      data: { data: { uspeshno: true, soobshcheniya: [] } },
    } as never)
    const redispatch = vi.fn().mockResolvedValue(true)

    await uploadFileByEffect(effect, redispatch)

    const call = vi.mocked(apiService.postFormData).mock.calls[0][0]
    expect(call.url).toBe('/api/vypiska-5-15/42/zagruzit-dannye')
    expect((call.data as FormData).get('file')).toBeInstanceOf(File)
    expect(redispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'reread',
    })
    expect(toasts[0].type).toBe('success')
  })

  it('отказ сервера (uspeshno=false): текст причины показан, форма не перечитывается', async () => {
    vi.mocked(pickFile).mockResolvedValue(file(10))
    vi.mocked(apiService.postFormData).mockResolvedValue({
      data: {
        data: {
          uspeshno: false,
          soobshcheniya: ['Сервис распознавания файлов не настроен'],
        },
      },
    } as never)
    const redispatch = vi.fn()

    await uploadFileByEffect(effect, redispatch)

    expect(toasts[0]).toEqual({
      type: 'error',
      title: 'Сервис распознавания файлов не настроен',
    })
    expect(redispatch).not.toHaveBeenCalled()
  })

  it('файл больше серверного предела не отправляется вовсе', async () => {
    vi.mocked(pickFile).mockResolvedValue(file(101))
    const redispatch = vi.fn()

    await uploadFileByEffect(effect, redispatch)

    expect(apiService.postFormData).not.toHaveBeenCalled()
    expect(redispatch).not.toHaveBeenCalled()
    expect(toasts[0].type).toBe('error')
  })

  it('пользователь закрыл диалог выбора — ни запроса, ни уведомления', async () => {
    vi.mocked(pickFile).mockResolvedValue(null)
    const redispatch = vi.fn()

    await uploadFileByEffect(effect, redispatch)

    expect(apiService.postFormData).not.toHaveBeenCalled()
    expect(toasts).toHaveLength(0)
  })

  it('сетевая ошибка отправки — сообщение пользователю, successCommand не шлётся', async () => {
    vi.mocked(pickFile).mockResolvedValue(file(10))
    vi.mocked(apiService.postFormData).mockRejectedValue(new Error('offline'))
    const redispatch = vi.fn()

    await uploadFileByEffect(effect, redispatch)

    expect(toasts[0].type).toBe('error')
    expect(redispatch).not.toHaveBeenCalled()
  })

  it('эффект без url — запроса нет', async () => {
    const redispatch = vi.fn()

    await uploadFileByEffect({ type: 'uploadFile' }, redispatch)

    expect(pickFile).not.toHaveBeenCalled()
    expect(apiService.postFormData).not.toHaveBeenCalled()
  })
})
