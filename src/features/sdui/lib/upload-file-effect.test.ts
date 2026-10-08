import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ValidationReport } from '@/entities/validation-report'
import { apiService } from '@/shared/api/api'

import type { ViewEffect } from '../types/view'
import { pickFile } from './pick-file'
import {
  uploadFileByEffect,
  type UploadFeedbackSink,
} from './upload-file-effect'

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

let reports: ValidationReport[]
function sink(): UploadFeedbackSink {
  return {
    report: (report) => {
      reports.push(report)
    },
  }
}

describe('эффект uploadFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    toasts.length = 0
    reports = []
  })

  it('чистый успех: файл уходит multipart-полем file, панель гасится, затем successCommand', async () => {
    vi.mocked(pickFile).mockResolvedValue(file(10))
    vi.mocked(apiService.postFormData).mockResolvedValue({
      data: { data: { uspeshno: true, soobshcheniya: [] } },
    } as never)
    const redispatch = vi.fn().mockResolvedValue(true)

    await uploadFileByEffect(effect, redispatch, sink())

    const call = vi.mocked(apiService.postFormData).mock.calls[0][0]
    expect(call.url).toBe('/api/vypiska-5-15/42/zagruzit-dannye')
    expect((call.data as FormData).get('file')).toBeInstanceOf(File)
    expect(redispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'reread',
    })
    // Пустой отчёт гасит панель от прошлой попытки; факт — коротким тостом.
    expect(reports).toHaveLength(1)
    expect(reports[0].messages).toHaveLength(0)
    expect(toasts[0].type).toBe('success')
  })

  it('отказ сервера (uspeshno=false): причины в панель ошибкой, без тоста и без перечитывания', async () => {
    vi.mocked(pickFile).mockResolvedValue(file(10))
    vi.mocked(apiService.postFormData).mockResolvedValue({
      data: {
        data: {
          uspeshno: false,
          soobshcheniya: [
            'Файл не соответствует форме 5-15А: не найден код организации.',
            'Загрузка отменена.',
          ],
        },
      },
    } as never)
    const redispatch = vi.fn()

    await uploadFileByEffect(effect, redispatch, sink())

    expect(reports).toHaveLength(1)
    const report = reports[0]
    expect(report.messages).toHaveLength(2)
    expect(report.messages.every((m) => m.severity === 'ERROR')).toBe(true)
    expect(report.messages.every((m) => m.blocking)).toBe(true)
    expect(report.messages[0].message).toBe(
      'Файл не соответствует форме 5-15А: не найден код организации.'
    )
    expect(report.blockingCount).toBe(2)
    // Текст — в панели (не гаснет), тостом его НЕ дублируем.
    expect(toasts).toHaveLength(0)
    expect(redispatch).not.toHaveBeenCalled()
  })

  it('успех с замечаниями: замечания в панель предупреждением (жёлтым), форма перечитывается', async () => {
    vi.mocked(pickFile).mockResolvedValue(file(10))
    vi.mocked(apiService.postFormData).mockResolvedValue({
      data: {
        data: {
          uspeshno: true,
          soobshcheniya: [
            'Пропущено записей файла: 3.',
            'Не найдены элементы справочника ФКР по кодам: 123/456/789.',
          ],
        },
      },
    } as never)
    const redispatch = vi.fn().mockResolvedValue(true)

    await uploadFileByEffect(effect, redispatch, sink())

    expect(reports).toHaveLength(1)
    const report = reports[0]
    expect(report.messages).toHaveLength(2)
    expect(report.messages.every((m) => m.severity === 'WARNING')).toBe(true)
    expect(report.messages.every((m) => !m.blocking)).toBe(true)
    expect(report.blockingCount).toBe(0)
    // Зелёного «успеха» с замечаниями внутри быть не должно.
    expect(toasts).toHaveLength(0)
    // Данные частично загружены — форму обязаны перечитать.
    expect(redispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'reread',
    })
  })

  it('отказ без текста причины: общий тост-фолбэк, панель пуста, без перечитывания', async () => {
    vi.mocked(pickFile).mockResolvedValue(file(10))
    vi.mocked(apiService.postFormData).mockResolvedValue({
      data: { data: { uspeshno: false, soobshcheniya: [] } },
    } as never)
    const redispatch = vi.fn()

    await uploadFileByEffect(effect, redispatch, sink())

    expect(reports[0].messages).toHaveLength(0)
    expect(toasts[0].type).toBe('error')
    expect(redispatch).not.toHaveBeenCalled()
  })

  it('файл больше серверного предела не отправляется вовсе', async () => {
    vi.mocked(pickFile).mockResolvedValue(file(101))
    const redispatch = vi.fn()

    await uploadFileByEffect(effect, redispatch, sink())

    expect(apiService.postFormData).not.toHaveBeenCalled()
    expect(redispatch).not.toHaveBeenCalled()
    expect(reports).toHaveLength(0)
    expect(toasts[0].type).toBe('error')
  })

  it('пользователь закрыл диалог выбора — ни запроса, ни уведомления', async () => {
    vi.mocked(pickFile).mockResolvedValue(null)
    const redispatch = vi.fn()

    await uploadFileByEffect(effect, redispatch, sink())

    expect(apiService.postFormData).not.toHaveBeenCalled()
    expect(reports).toHaveLength(0)
    expect(toasts).toHaveLength(0)
  })

  it('сетевая ошибка отправки — тост пользователю, панель не трогаем, successCommand не шлётся', async () => {
    vi.mocked(pickFile).mockResolvedValue(file(10))
    vi.mocked(apiService.postFormData).mockRejectedValue(new Error('offline'))
    const redispatch = vi.fn()

    await uploadFileByEffect(effect, redispatch, sink())

    expect(toasts[0].type).toBe('error')
    // Транспортный сбой — не «файл не тот»: отчёт экрана не меняем.
    expect(reports).toHaveLength(0)
    expect(redispatch).not.toHaveBeenCalled()
  })

  it('эффект без url — запроса нет', async () => {
    const redispatch = vi.fn()

    await uploadFileByEffect({ type: 'uploadFile' }, redispatch, sink())

    expect(pickFile).not.toHaveBeenCalled()
    expect(apiService.postFormData).not.toHaveBeenCalled()
    expect(reports).toHaveLength(0)
  })
})
