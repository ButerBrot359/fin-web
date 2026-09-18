import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiConflictError, ApiHttpError, ApiTransportError } from './api-error'

// Мокается только инстанс (create → request): классы axios (AxiosError и её
// коды) остаются настоящими — на них завязан маппинг в rethrowApiError.
const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }))

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    default: {
      ...(actual.default as Record<string, unknown>),
      create: vi.fn(() => ({
        request: requestMock,
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      })),
    },
  }
})

vi.mock('@/app/config/i18n', () => ({
  default: { language: 'ru', t: (key: string) => key },
}))
vi.mock('./auth/attach-auth-interceptors', () => ({
  attachAuthInterceptors: vi.fn(),
}))

const { apiService } = await import('./api')

const axiosErrorWithResponse = (status: number, data: unknown) =>
  new AxiosError(
    'Request failed',
    AxiosError.ERR_BAD_REQUEST,
    undefined,
    undefined,
    { status, data, statusText: '', headers: {}, config: {} } as never
  )

describe('маппинг ошибок api-слоя (W-6)', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  it('успешный ответ проходит как есть', async () => {
    requestMock.mockResolvedValue({ data: { ok: true } })
    await expect(apiService.get({ url: '/x' })).resolves.toEqual({
      data: { ok: true },
    })
  })

  it('4xx с телом → ApiHttpError со статусом, телом и message из тела', async () => {
    requestMock.mockRejectedValue(
      axiosErrorWithResponse(422, {
        message: 'Не заполнен счёт',
        errors: [{ attributeCode: 'account', message: 'Не заполнен счёт' }],
      })
    )
    const error = await apiService.get({ url: '/x' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiHttpError)
    const httpError = error as ApiHttpError
    expect(httpError.status).toBe(422)
    expect(httpError.body).toEqual({
      message: 'Не заполнен счёт',
      errors: [{ attributeCode: 'account', message: 'Не заполнен счёт' }],
    })
    expect(httpError.message).toBe('Не заполнен счёт')
  })

  it('4xx без тела → ApiHttpError с генерик-message по статусу', async () => {
    requestMock.mockRejectedValue(axiosErrorWithResponse(400, undefined))
    const error = await apiService.post({ url: '/x' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiHttpError)
    const httpError = error as ApiHttpError
    expect(httpError.status).toBe(400)
    expect(httpError.body).toBeUndefined()
    expect(httpError.message).toBe('HTTP 400')
  })

  it('message берётся и из detail/error, когда message в теле нет', async () => {
    requestMock.mockRejectedValue(
      axiosErrorWithResponse(403, { detail: 'Доступ запрещён' })
    )
    const error = await apiService.get({ url: '/x' }).catch((e: unknown) => e)
    expect((error as ApiHttpError).message).toBe('Доступ запрещён')

    requestMock.mockRejectedValue(
      axiosErrorWithResponse(500, { error: 'Internal Server Error' })
    )
    const error2 = await apiService.get({ url: '/x' }).catch((e: unknown) => e)
    expect((error2 as ApiHttpError).message).toBe('Internal Server Error')
  })

  it('таймаут остаётся ApiTransportError(timeout)', async () => {
    requestMock.mockRejectedValue(
      new AxiosError('timeout of 60000ms exceeded', AxiosError.ECONNABORTED)
    )
    const error = await apiService.get({ url: '/x' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiTransportError)
    expect((error as ApiTransportError).kind).toBe('timeout')
  })

  it('обрыв сети остаётся ApiTransportError(network)', async () => {
    requestMock.mockRejectedValue(
      new AxiosError('Network Error', AxiosError.ERR_NETWORK)
    )
    const error = await apiService.get({ url: '/x' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiTransportError)
    expect((error as ApiTransportError).kind).toBe('network')
  })

  it('504 от шлюза остаётся ApiTransportError(gateway), не ApiHttpError', async () => {
    requestMock.mockRejectedValue(
      axiosErrorWithResponse(504, '<html>nginx</html>')
    )
    const error = await apiService.get({ url: '/x' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiTransportError)
    expect((error as ApiTransportError).kind).toBe('gateway')
  })

  it('409 остаётся ApiConflictError с code/message из тела', async () => {
    requestMock.mockRejectedValue(
      axiosErrorWithResponse(409, {
        code: 'OBJECT_LOCKED',
        message: 'Объект занят пользователем Иванов',
      })
    )
    const error = await apiService.put({ url: '/x' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiConflictError)
    const conflict = error as ApiConflictError
    expect(conflict.code).toBe('OBJECT_LOCKED')
    expect(conflict.message).toBe('Объект занят пользователем Иванов')
  })

  it('не-axios ошибка пробрасывается как есть', async () => {
    const boom = new Error('boom')
    requestMock.mockRejectedValue(boom)
    await expect(apiService.get({ url: '/x' })).rejects.toBe(boom)
  })
})
